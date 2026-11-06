import { useEffect, useMemo, useState } from "react";
import { createSimulationSnapshot } from "../model/viewerSimulation.js";

const EMPTY = [];

export default function useViewerSimulation({ allowed, equipmentId, modelVersion, rois, sensors }) {
  const [active, setActive] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [selectedRoiId, setSelectedRoiId] = useState("");
  const [levelDb, setLevelDb] = useState(68);
  const [averageTemperature, setAverageTemperature] = useState(48);
  const [peakHz, setPeakHz] = useState(32000);
  const [gaugeValue, setGaugeValue] = useState(65);
  const [alternateState, setAlternateState] = useState(false);
  const [ledColor, setLedColor] = useState("GREEN");
  const [pulse, setPulse] = useState({ sequence: 0, measuredAt: null, values: null });
  const [alarm, setAlarm] = useState(null);
  const [now, setNow] = useState(Date.now);
  const scoped = useMemo(() => rois.filter((roi) => roi.equipmentId === equipmentId), [rois, equipmentId]);
  const projectedThermalCount = sensors.filter((sensor) => sensor.textureProjection?.enabled && sensor.textureProjection.kind === "THERMAL"
    && (sensor.textureProjection.equipmentId ?? sensor.equipmentIds?.[0]) === equipmentId).length;
  const targetId = scoped.some((roi) => roi.id === selectedRoiId) ? selectedRoiId : scoped[0]?.id ?? "";
  const values = { levelDb, averageTemperature, peakHz, gaugeValue, alternateState, ledColor };
  const inject = () => setPulse((current) => ({ sequence: current.sequence + 1, measuredAt: new Date().toISOString(), values }));

  useEffect(() => {
    if (!allowed || !active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [allowed, active]);
  useEffect(() => {
    if (!allowed || !active || !automatic) return undefined;
    const timer = setInterval(() => setPulse((current) => ({ sequence: current.sequence + 1,
      measuredAt: new Date().toISOString(), values: { levelDb, averageTemperature, peakHz, gaugeValue, alternateState, ledColor } })), 3000);
    return () => clearInterval(timer);
  }, [allowed, active, automatic, levelDb, averageTemperature, peakHz, gaugeValue, alternateState, ledColor]);

  const snapshot = useMemo(() => !allowed || !active || !pulse.measuredAt ? null : createSimulationSnapshot({
    equipmentId, modelVersion, rois: scoped, selectedRoiId: targetId, sensors,
    ...pulse.values, sequence: pulse.sequence, measuredAt: pulse.measuredAt, alarm,
  }), [allowed, active, pulse, equipmentId, modelVersion, scoped, targetId, sensors, alarm]);
  const triggerAlarm = (severity) => {
    const measuredAt = new Date().toISOString();
    setAlarm((current) => ({ sequence: (current?.sequence ?? 0) + 1, severity, measuredAt }));
    setPulse((current) => ({ sequence: current.sequence + 1, measuredAt, values }));
  };
  const clear = () => { setAutomatic(false); setPulse((current) => ({ ...current, measuredAt: null, values: null })); setAlarm(null); };
  const telemetry = active ? { textures: EMPTY, hotspots: snapshot?.hotspots ?? EMPTY, readings: snapshot?.readings ?? EMPTY,
    alarms: snapshot?.alarms ?? EMPTY, status: "DEMO", error: "", demo: true, simulated: true, now,
    acknowledge: async () => setAlarm(null), simulateAlarm: () => triggerAlarm("WARNING") } : null;
  return { allowed, active, setActive, automatic, setAutomatic, scoped, projectedThermalCount, targetId, setSelectedRoiId,
    levelDb, setLevelDb, averageTemperature, setAverageTemperature, peakHz, setPeakHz,
    gaugeValue, setGaugeValue, alternateState, setAlternateState, ledColor, setLedColor,
    pulse, snapshot, telemetry, inject, triggerAlarm, clear };
}
