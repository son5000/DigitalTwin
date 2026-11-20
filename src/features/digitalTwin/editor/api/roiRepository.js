import { isObservationRoi, observationPointToRoi, roiToObservationPoint, roiFromReferencePayload, roiToReferencePayload, validateRoi } from "../model/roiMonitoring.js";
import { normalizeObservationPoint } from "../model/equipmentDetailModel.js";
import { readProjects, roiStorageKey, updateProjectObservationPoints } from "../../../portal/projects/projectRepository.js";
import { projectApiBase } from "../../../portal/projects/projectConfigurationApi.js";

export { roiStorageKey };
import { monitoringApiBase, monitoringRequest as request, uploadRoiReferenceImage } from "./monitoringClient.js";
export { monitoringApiBase, lookupSensor } from "./monitoringClient.js";

export async function loadMonitoringProject(projectId, signal) {
  const result = await request(`/projects/${encodeURIComponent(projectId)}`, { signal });
  if (result?.project?.id !== projectId || !result.project.layout?.hierarchy) throw new Error("프로젝트 구성 형식을 확인하세요.");
  return result.project;
}

export function createRoiRepository(projectId, storage = window.localStorage) {
  const path = `/projects/${encodeURIComponent(projectId)}/rois`;
  const localProject = readProjects(storage).projects.find((project) => project.id === projectId || project.serverProjectId === projectId);
  const localId = localProject?.id ?? projectId;
  const localModeKey = `${roiStorageKey(localId)}:local`;
  const backendProject = Boolean(projectApiBase) && (!localProject || localProject.storageMode === "SERVER");
  const remoteEnabled = Boolean(monitoringApiBase) && !monitoringApiBase.endsWith("/api/fe/v1") && !backendProject && localProject?.storageMode !== "LOCAL";
  const isShared = () => remoteEnabled && storage.getItem(localModeKey) !== "1";
  function readLocal() {
    const raw = storage.getItem(roiStorageKey(localId));
    const storedLayout = readProjects(storage).projects.find((project) => project.id === localId)?.layout;
    const records = raw ? JSON.parse(raw) : storedLayout?.importedRois ?? [];
    if (!Array.isArray(records)) throw new Error("저장된 ROI를 읽을 수 없습니다. 기존 데이터는 유지됩니다.");
    const layout = readProjects(storage).projects.find((project) => project.id === localId)?.layout;
    const spheres = (layout?.observationConfig?.observationPoints ?? layout?.observationPoints ?? []).map((point) => observationPointToRoi(normalizeObservationPoint(point)));
    const merged = new Map(records.map((record) => { const roi = validateRoi(roiFromReferencePayload(record)); return [roi.id, roi]; }));
    for (const roi of spheres) if (!merged.has(roi.id) || roi.revision >= merged.get(roi.id).revision) merged.set(roi.id, roi);
    return [...merged.values()].map(validateRoi);
  }
  function writeLocal(roi, removed = false) {
    const key = roiStorageKey(localId), previous = storage.getItem(key);
    const hasProject = readProjects(storage).projects.some((project) => project.id === localId);
    const records = readLocal().filter((item) => item.id !== roi.id);
    const next = removed ? records : [...records, roi];
    // Observation points live in the layout, not in a competing second snapshot.
    storage.setItem(key, JSON.stringify(hasProject ? next.filter((item) => !isObservationRoi(item)) : next));
    const point = isObservationRoi(roi) ? normalizeObservationPoint(roiToObservationPoint(roi)) : null;
    try {
      if (point && hasProject) {
        updateProjectObservationPoints(localId, () => next.filter(isObservationRoi)
          .map((item) => normalizeObservationPoint(roiToObservationPoint(item))), storage);
      }
    } catch (error) {
      if (previous === null) storage.removeItem(key); else storage.setItem(key, previous);
      throw error;
    }
    window.dispatchEvent(new CustomEvent("digital-twin-roi-change", { detail: { projectId: localId,
      ...(removed ? { removedId: roi.id } : point ? { point } : {}) } }));
    return point ? observationPointToRoi(point) : roi;
  }
  return {
    get shared() { return isShared(); },
    listLocal: readLocal,
    async list(signal) {
      if (!isShared()) return readLocal();
      try {
        const result = await request(path, { signal });
        if (!Array.isArray(result?.rois)) throw new Error("서버의 ROI 목록 형식을 확인하세요.");
        const rois = result.rois.map(roiFromReferencePayload).map(validateRoi);
        // An in-flight list must not overwrite a save or deletion made locally.
        if (!isShared()) return readLocal();
        storage.setItem(roiStorageKey(localId), JSON.stringify(rois));
        return readLocal();
      } catch {
        return readLocal();
      }
    },
    async save(input, equipment) {
      const roi = validateRoi(input);
      const existing = readLocal().find((item) => item.id === roi.id);
      if (existing && existing.revision !== roi.revision) throw new Error("다른 화면에서 변경했습니다. 목록을 새로고침하세요.");
      const shared = isShared();
      // Keep local changes authoritative across refresh/reload until explicitly synced.
      storage.setItem(localModeKey, "1");
      const saved = writeLocal({ ...roi, revision: roi.revision + 1, updatedAt: new Date().toISOString() });
      if (shared) try {
        const measurements = await Promise.all((roi.measurements ?? []).map(async (item) => {
          const frame = item.analysisConfig?.referenceFrame;
          if (!frame?.textureAssetId || frame.serverAssetId) return item;
          return { ...item, analysisConfig: { ...item.analysisConfig,
            referenceFrame: await uploadRoiReferenceImage(projectId, roi.equipmentId, roi.id, item.id, frame) } };
        }));
        const withAssets = { ...roi, measurements,
          ...(roi.observationPoint ? { observationPoint: { ...roi.observationPoint, measurements } } : {}) };
        const payload = roiToReferencePayload(withAssets, equipment);
        const result = await request(`${path}/${encodeURIComponent(roi.id)}`, {
          method: "PUT", headers: { "If-Match": String(roi.revision) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
        });
        if (payload.coordinateFrame && !result.roi?.coordinateFrame) throw new Error("서버 ROI 응답에 기준좌표 정보가 없습니다.");
        const remote = validateRoi(roiFromReferencePayload(result.roi));
        if (remote.id !== roi.id || remote.revision <= roi.revision) throw new Error("서버 ROI 저장 버전을 확인하세요.");
        if (readLocal().find((item) => item.id === roi.id)?.revision !== saved.revision) return saved;
        const confirmed = writeLocal(remote);
        storage.removeItem(localModeKey);
        return confirmed;
      } catch { /* The local copy, including reference-image IDs, remains usable. */ }
      return saved;
    },
    async remove(roi) {
      const records = readLocal();
      if (records.find((item) => item.id === roi.id)?.revision !== roi.revision) throw new Error("다른 화면에서 변경했습니다. 목록을 새로고침하세요.");
      const shared = isShared();
      storage.setItem(localModeKey, "1");
      writeLocal(roi, true);
      if (shared) try {
        await request(`${path}/${encodeURIComponent(roi.id)}`, { method: "DELETE", headers: { "If-Match": String(roi.revision) }, signal: AbortSignal.timeout(15000) });
        // Keep the local list authoritative so stale server lists cannot revive it.
      } catch { /* Deletion is already persisted in this browser. */ }
    },
    async readings(signal) {
      if (!isShared()) return [];
      try {
        const result = await request(`${path}/readings`, { signal });
        return Array.isArray(result?.readings) ? result.readings : [];
      } catch { return []; }
    },
    async preview(roi, signal, equipment) {
      if (!isShared()) return null;
      const query = validateRoi({ ...roi, name: roi.name.trim() || "임시 ROI", rules: [], monitoringEnabled: false });
      const result = await request(`${path}/preview`, { method: "POST", body: JSON.stringify(roiToReferencePayload(query, equipment)), signal });
      return result.reading;
    },
  };
}
