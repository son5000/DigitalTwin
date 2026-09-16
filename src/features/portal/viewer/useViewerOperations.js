import { useEffect, useMemo, useSyncExternalStore } from "react";
import { emptyOperations, ingestNotifications, operationsKey, readOperations, updateOperations } from "./operationsModel.js";

function createStore(projectId) {
  let state;
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());
  function refresh() {
    try { state = { data: readOperations(window.localStorage, projectId), error: "" }; }
    catch (error) { state = { data: state?.data ?? emptyOperations(), error: error.message }; }
  }
  refresh();
  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      const sync = (event) => { if (event.key === null || event.key === operationsKey(projectId)) { refresh(); emit(); } };
      window.addEventListener("storage", sync);
      return () => { listeners.delete(listener); window.removeEventListener("storage", sync); };
    },
    change(updater) {
      try {
        const data = updateOperations(window.localStorage, projectId, updater);
        state = { data, error: "" }; emit(); return true;
      } catch (error) {
        state = { ...state, error: `저장하지 못했습니다. ${error.message}` }; emit(); return false;
      }
    },
    ingest(incoming) {
      if (!incoming.length) return;
      if (ingestNotifications(state.data, incoming) !== state.data) this.change((data) => ingestNotifications(data, incoming));
    },
  };
}

export default function useViewerOperations(projectId, notifications) {
  const store = useMemo(() => createStore(projectId), [projectId]);
  const state = useSyncExternalStore(store.subscribe, store.snapshot);
  useEffect(() => { store.ingest(notifications); }, [store, notifications]);
  return { ...state, change: store.change };
}
