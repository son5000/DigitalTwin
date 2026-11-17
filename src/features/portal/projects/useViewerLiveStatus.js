import { useEffect, useMemo, useState } from "react";
import { projectApiBase } from "./projectConfigurationApi.js";
import { getViewerEquipmentContext } from "../viewer/worldTreeModel.js";
import { loadEnclosureSnapshot, loadEquipmentMapping, openViewerEvents, summarizeEnclosure } from "./projectViewerLiveApi.js";

const DISCONNECTED = { snapshot: null, status: "DISCONNECTED", error: "", now: 0 };

export default function useViewerLiveStatus(projectId, revision, enabled, tree, layout) {
  const key = `${projectId}:${revision}`;
  const [state, setState] = useState({ ...DISCONNECTED, key });
  const equipmentIds = useMemo(() => [...tree.nodes.values()]
    .filter((node) => ["EQUIPMENT", "SITE_OBJECT"].includes(node.type) && getViewerEquipmentContext(tree, node))
    .map((node) => node.id), [tree]);
  const sensorBindings = useMemo(() => layout.sensorBindings ?? layout.observationConfig?.sensorBindings ?? [], [layout]);

  useEffect(() => {
    if (!enabled || !projectApiBase || !Number.isInteger(revision) || revision < 1) return;
    let active = true, stream, reconnectTimer, pollTimer, requestVersion = 0;
    const controller = new AbortController();
    const mappings = new Map(), snapshots = new Map(), eventSequences = new Map();
    const viewTypes = (equipmentId) => {
      const types = new Set(sensorBindings.filter((item) => item.equipmentIds?.includes(equipmentId))
        .flatMap((item) => item.capabilities ?? []).filter((value) => ["VISION", "THERMAL", "ULTRASONIC"].includes(value)));
      return types.size ? [...types] : ["VISION"];
    };
    const reportError = (error) => {
      if (active && error.name !== "AbortError") setState((current) => ({ ...current, key, status: "ERROR", error: error.message, now: Date.now() }));
    };
    function report() {
      if (!active) return;
      const equipment = [], sensors = [];
      for (const equipmentId of equipmentIds) {
        const uid = mappings.get(equipmentId);
        const summary = summarizeEnclosure(equipmentId, uid ? snapshots.get(uid) ?? [] : [], sensorBindings);
        equipment.push(summary.equipment);
        sensors.push(...summary.sensors);
      }
      setState({ key, snapshot: { projectId, revision, generatedAt: new Date().toISOString(), equipment, sensors, measurements: [] },
        status: [...mappings.values()].some(Boolean) ? "CONNECTED" : "UNMAPPED", error: "", now: Date.now() });
    }
    async function refresh() {
      const version = ++requestVersion;
      try {
        const requests = [...new Set([...mappings.values()].filter(Boolean))].flatMap((uid) => {
          const ids = equipmentIds.filter((id) => mappings.get(id) === uid);
          const types = new Set(ids.flatMap(viewTypes));
          return [...types].map(async (type) => [uid, await loadEnclosureSnapshot(uid, type, controller.signal)]);
        });
        const entries = await Promise.all(requests);
        if (!active || version !== requestVersion) return;
        snapshots.clear();
        for (const [uid, snapshot] of entries) snapshots.set(uid, [...(snapshots.get(uid) ?? []), snapshot]);
        report();
      } catch (error) { reportError(error); }
    }
    function connect() {
      if (!active || ![...mappings.values()].some(Boolean)) return;
      try {
        stream = openViewerEvents();
        stream.onopen = () => {
          eventSequences.clear();
          for (const uid of new Set([...mappings.values()].filter(Boolean))) {
            stream.send(JSON.stringify({ op: "SUBSCRIBE", enclosure_uid: uid }));
          }
          void refresh();
        };
        stream.onmessage = (event) => {
          try {
            const notice = JSON.parse(event.data);
            if (!notice || !["texture.changed", "observation.changed", "alarm.changed", "command.changed"].includes(notice.type)
              || ![...mappings.values()].includes(notice.enclosure_uid)) return;
            if (typeof notice.stream_epoch !== "string" || !/^\d+$/.test(notice.seq)) return;
            const last = eventSequences.get(notice.enclosure_uid);
            const sequence = BigInt(notice.seq);
            if (last?.epoch === notice.stream_epoch && sequence <= last.sequence) return;
            eventSequences.set(notice.enclosure_uid, { epoch: notice.stream_epoch, sequence });
            void refresh();
          } catch { /* Invalid notifications do not replace the last valid REST snapshot. */ }
        };
        stream.onclose = () => {
          if (!active) return;
          setState((current) => ({ ...current, key, status: "RECONNECTING", error: "실시간 통지를 다시 연결하는 중입니다.", now: Date.now() }));
          reconnectTimer = setTimeout(connect, 3000);
        };
        stream.onerror = () => { stream.close(); };
      } catch (error) { reportError(error); reconnectTimer = setTimeout(connect, 3000); }
    }
    async function start() {
      try {
        const entries = await Promise.all(equipmentIds.map(async (id) => [id, await loadEquipmentMapping(projectId, id, controller.signal)]));
        if (!active) return;
        for (const [id, uid] of entries) mappings.set(id, uid);
        await refresh();
        if (active) connect();
      } catch (error) { reportError(error); }
    }
    void Promise.resolve().then(() => {
      if (!active) return;
      setState({ ...DISCONNECTED, key, status: "CONNECTING", now: Date.now() });
      void start();
    });
    pollTimer = setInterval(() => { if ([...mappings.values()].some(Boolean)) void refresh(); else void start(); }, 15000);
    const clock = setInterval(() => { if (active) setState((current) => ({ ...current, now: Date.now() })); }, 3000);
    return () => { active = false; controller.abort(); stream?.close(); clearTimeout(reconnectTimer); clearInterval(pollTimer); clearInterval(clock); };
  }, [key, projectId, revision, enabled, equipmentIds, sensorBindings]);

  return enabled && projectApiBase && state.key === key ? state : { ...DISCONNECTED, key };
}
