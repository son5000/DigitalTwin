import { useMemo, useSyncExternalStore } from "react";
import { createRoiRepository, roiStorageKey } from "../api/roiRepository.js";

const stores = new Map();
function createStore(projectId) {
  const repository = createRoiRepository(projectId);
  let state = { rois: [], readings: [], loading: true, error: "", now: Date.now(), shared: repository.shared };
  let timer, controller, generation = 0, refreshing = false;
  const listeners = new Set();
  const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); };
  async function refresh() {
    refreshing = true;
    const version = ++generation;
    controller?.abort();
    controller = new AbortController();
    const requestController = controller;
    const timeout = setTimeout(() => requestController.abort(), 10000);
    try {
      const [rois, readings] = await Promise.all([repository.list(controller.signal), repository.readings(controller.signal)]);
      if (version === generation) emit({ rois, readings, error: "", loading: false, now: Date.now() });
    } catch (error) {
      if (version === generation) emit({ error: error.name === "AbortError" ? "서버 응답이 지연되고 있습니다. 다시 연결합니다." : error.message, readings: [], loading: false, now: Date.now() });
    } finally { clearTimeout(timeout); if (version === generation) refreshing = false; }
  }
  const sync = (event) => { if (event.key === null || event.key === roiStorageKey(projectId)) void refresh(); };
  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        void refresh();
        window.addEventListener("storage", sync);
        timer = setInterval(() => { emit({ now: Date.now() }); if (repository.shared && !refreshing) void refresh(); }, 3000);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { clearInterval(timer); generation++; controller?.abort(); window.removeEventListener("storage", sync); }
      };
    },
    refresh,
    async save(roi) { const saved = await repository.save(roi); await refresh(); return saved; },
    async remove(roi) { await repository.remove(roi); await refresh(); },
    preview: repository.preview,
  };
}

export default function useRoiMonitoring(projectId) {
  const store = useMemo(() => {
    if (!stores.has(projectId)) stores.set(projectId, createStore(projectId));
    return stores.get(projectId);
  }, [projectId]);
  const state = useSyncExternalStore(store.subscribe, store.snapshot);
  return { ...state, save: store.save, remove: store.remove, refresh: store.refresh, preview: store.preview };
}
