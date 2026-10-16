import { useEffect, useRef, useState } from "react";
import { equipmentPath, loadEquipmentTelemetry, monitoringApiBase, acknowledgeAlarm } from "../api/monitoringClient";
import { validateTelemetry } from "../model/monitoringContract";
import { demoReading } from "../model/monitoringDemo";

const EMPTY = { textures: [], hotspots: [], readings: [], alarms: [] };
export default function useEquipmentTelemetry(projectId, equipmentId, rois) {
  const [demo, setDemo] = useState(false);
  const [state, setState] = useState({ ...EMPTY, key: "", status: "DISCONNECTED", error: "" });
  const [now, setNow] = useState(Date.now);
  const roisRef = useRef(rois);
  useEffect(() => { roisRef.current = rois; }, [rois]);
  const key = `${projectId}:${equipmentId}:${demo}`;
  useEffect(() => {
    if (!equipmentId) return;
    let active = true, stream, timer, requestId = 0;
    const controller = new AbortController();
    const ruleStarts = new Map(), lastStatuses = new Map();
    function accept(input) {
      if (!active) return;
      const data = validateTelemetry(input, equipmentId);
      setState((previous) => {
        const alarms = new Map((previous.key === key ? previous.alarms : []).map((alarm) => [alarm.id, alarm]));
        data.alarms.filter((alarm) => alarm.id && ["WARNING", "DANGER"].includes(alarm.severity) && Number.isFinite(Date.parse(alarm.occurredAt))).forEach((alarm) => alarms.set(alarm.id, alarm));
        return { ...data, key, alarms: [...alarms.values()].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 100), status: demo ? "DEMO" : "CONNECTED", error: "" };
      });
    }
    function tickDemo() {
      const measuredAt = Date.now(), alarms = [];
      const readings = roisRef.current.filter((roi) => roi.equipmentId === equipmentId).map((roi) => {
        const reading = demoReading(roi, measuredAt);
        let status = "NORMAL";
        if (roi.monitoringEnabled) roi.rules.forEach((rule, index) => {
          const id = `${roi.id}:${roi.revision}:${index}`, value = reading.values[rule.metric];
          const exceeds = rule.operator === "lt" ? value < rule.threshold : rule.operator === "gte" ? value >= rule.threshold : value > rule.threshold;
          if (!exceeds) { ruleStarts.delete(id); return; }
          if (!ruleStarts.has(id)) ruleStarts.set(id, measuredAt);
          if (measuredAt - ruleStarts.get(id) >= rule.durationSeconds * 1000 && status !== "DANGER") status = rule.severity;
        });
        reading.status = status;
        const last = lastStatuses.get(roi.id) ?? "NORMAL";
        if (status !== "NORMAL" && status !== last) alarms.push({ id: `demo:${roi.id}:${measuredAt}`, roiId: roi.id, name: roi.name, severity: status, occurredAt: reading.measuredAt, message: "예시 측정값이 저장한 ROI 조건을 충족했습니다.", dataSource: "DEMO" });
        lastStatuses.set(roi.id, status);
        return reading;
      });
      accept({ equipmentId, readings, alarms, measuredAt: new Date(measuredAt).toISOString(), quality: "GOOD" });
    }
    async function start() {
      if (demo) { tickDemo(); timer = setInterval(tickDemo, 1000); return; }
      if (!monitoringApiBase) { if (active) setState({ ...EMPTY, key, status: "DISCONNECTED", error: "" }); return; }
      setState({ ...EMPTY, key, status: "CONNECTING", error: "" });
      try {
        const initial = await loadEquipmentTelemetry(projectId, equipmentId, controller.signal);
        accept(initial);
      } catch (error) { if (active) setState({ ...EMPTY, key, status: "ERROR", error: error.message }); }
      if (!active) return;
      stream = new EventSource(`${monitoringApiBase}${equipmentPath(projectId, equipmentId)}/events`);
      stream.onmessage = (event) => {
        try { requestId++; accept(JSON.parse(event.data)); }
        catch (error) { if (active) setState((previous) => ({ ...previous, status: "ERROR", textures: [], hotspots: [], readings: [], error: error.message })); }
      };
      stream.onopen = async () => {
        const version = ++requestId;
        try { const latest = await loadEquipmentTelemetry(projectId, equipmentId, controller.signal); if (version === requestId) accept(latest); }
        catch (error) { if (active && version === requestId) setState((previous) => ({ ...previous, status: "ERROR", error: error.message })); }
      };
      stream.onerror = () => { requestId++; if (active) setState((previous) => ({ ...previous, status: "RECONNECTING", textures: [], hotspots: [], readings: [], error: "관측 연결이 끊겼습니다. 자동 재연결 중입니다." })); };
    }
    void Promise.resolve().then(() => { if (active) void start(); });
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; controller.abort(); stream?.close(); clearInterval(timer); clearInterval(clock); };
  }, [key, projectId, equipmentId, demo]);

  async function acknowledge(alarm) {
    if (!demo) await acknowledgeAlarm(projectId, equipmentId, alarm.id);
    setState((current) => current.key !== key ? current : { ...current, alarms: current.alarms.map((item) => item.id === alarm.id ? { ...item, acknowledgedAt: new Date().toISOString() } : item) });
  }
  function simulateAlarm() {
    if (!demo) return;
    const time = new Date().toISOString();
    setState((current) => ({ ...current, key, alarms: [{ id: `demo:manual:${time}`, severity: "WARNING", occurredAt: time, name: "경고 수신 예시", message: "화면 경고 표시를 확인하는 테스트 이벤트입니다.", dataSource: "DEMO" }, ...(current.key === key ? current.alarms : [])].slice(0, 100) }));
  }
  return { ...(state.key === key ? state : { ...EMPTY, status: "CONNECTING", error: "" }), demo, setDemo, now, acknowledge, simulateAlarm };
}
