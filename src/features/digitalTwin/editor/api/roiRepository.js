import { isObservationRoi, observationPointToRoi, roiToObservationPoint, roiFromReferencePayload, roiToReferencePayload, validateRoi } from "../model/roiMonitoring.js";
import { normalizeObservationPoint } from "../model/equipmentDetailModel.js";
import { readProjects, updateProjectObservationPoints } from "../../../portal/projects/projectRepository.js";

export const roiStorageKey = (projectId) => `digital-twin-rois-v1:${projectId}`;
import { monitoringApiBase, monitoringRequest as request } from "./monitoringClient.js";
export { monitoringApiBase, lookupSensor } from "./monitoringClient.js";

export async function loadMonitoringProject(projectId, signal) {
  const result = await request(`/projects/${encodeURIComponent(projectId)}`, { signal });
  if (result?.project?.id !== projectId || !result.project.layout?.hierarchy) throw new Error("프로젝트 구성 형식을 확인하세요.");
  return result.project;
}

export function createRoiRepository(projectId, storage = window.localStorage) {
  const path = `/projects/${encodeURIComponent(projectId)}/rois`;
  const shared = Boolean(monitoringApiBase) && readProjects(storage).projects.find((project) => project.id === projectId)?.storageMode !== "LOCAL";
  function readLocal() {
    const raw = storage.getItem(roiStorageKey(projectId));
    const records = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(records)) throw new Error("저장된 ROI를 읽을 수 없습니다. 기존 데이터는 유지됩니다.");
    const layout = readProjects(storage).projects.find((project) => project.id === projectId)?.layout;
    const spheres = (layout?.observationConfig?.observationPoints ?? layout?.observationPoints ?? []).map((point) => observationPointToRoi(normalizeObservationPoint(point)));
    return [...records.filter((roi) => !spheres.some((sphere) => sphere.id === roi.id)), ...spheres].map(roiFromReferencePayload).map(validateRoi);
  }
  return {
    shared,
    async list(signal) {
      if (!shared) return readLocal();
      const result = await request(path, { signal });
      if (!Array.isArray(result?.rois)) throw new Error("서버의 ROI 목록 형식을 확인하세요.");
      return result.rois.map(roiFromReferencePayload).map(validateRoi);
    },
    async save(input, equipment) {
      const roi = validateRoi(input);
      const payload = roiToReferencePayload(roi, equipment);
      if (shared) {
        const result = await request(`${path}/${encodeURIComponent(roi.id)}`, {
          method: "PUT", headers: { "If-Match": String(roi.revision) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
        });
        if (payload.coordinateFrame && !result.roi?.coordinateFrame) throw new Error("서버 ROI 응답에 기준좌표 정보가 없습니다.");
        return validateRoi(roiFromReferencePayload(result.roi));
      }
      const records = readLocal();
      const existing = records.find((item) => item.id === roi.id);
      if ((existing?.revision ?? 0) !== roi.revision) throw new Error("다른 화면에서 변경했습니다. 목록을 새로고침하세요.");
      const saved = { ...roi, revision: roi.revision + 1, updatedAt: new Date().toISOString() };
      if (isObservationRoi(saved)) {
        const point = normalizeObservationPoint(roiToObservationPoint(saved));
        updateProjectObservationPoints(projectId, (points) => [...points.filter((item) => item.id !== point.id), point], storage);
        window.dispatchEvent(new CustomEvent("digital-twin-roi-change", { detail: { projectId, point } }));
        return observationPointToRoi(point);
      } else storage.setItem(roiStorageKey(projectId), JSON.stringify([...records.filter((item) => !isObservationRoi(item) && item.id !== roi.id), roiToReferencePayload(saved, equipment)]));
      return saved;
    },
    async remove(roi) {
      if (shared) return request(`${path}/${encodeURIComponent(roi.id)}`, { method: "DELETE", headers: { "If-Match": String(roi.revision) }, signal: AbortSignal.timeout(15000) });
      const records = readLocal();
      if (records.find((item) => item.id === roi.id)?.revision !== roi.revision) throw new Error("다른 화면에서 변경했습니다. 목록을 새로고침하세요.");
      if (isObservationRoi(roi)) {
        updateProjectObservationPoints(projectId, (points) => points.filter((point) => point.id !== roi.id), storage);
        window.dispatchEvent(new CustomEvent("digital-twin-roi-change", { detail: { projectId, removedId: roi.id } }));
      } else storage.setItem(roiStorageKey(projectId), JSON.stringify(records.filter((item) => !isObservationRoi(item) && item.id !== roi.id)));
    },
    async readings(signal) {
      if (!shared) return [];
      const result = await request(`${path}/readings`, { signal });
      if (!Array.isArray(result?.readings)) throw new Error("서버의 측정값 형식을 확인하세요.");
      return result.readings;
    },
    async preview(roi, signal, equipment) {
      if (!shared) return null;
      const query = validateRoi({ ...roi, name: roi.name.trim() || "임시 ROI", rules: [], monitoringEnabled: false });
      const result = await request(`${path}/preview`, { method: "POST", body: JSON.stringify(roiToReferencePayload(query, equipment)), signal });
      return result.reading;
    },
  };
}
