import { useEffect, useMemo, useRef, useState } from "react";
import { observationReadings, observationStatus } from "../model/observationReadings.js";
import { isObservationRoi, roiToObservationPoint } from "../model/roiMonitoring.js";
import { temperatureSummary } from "../model/thermalFrame.js";
import { getSensorCapabilities } from "../model/equipmentDetailModel.js";
import { createSimulationSnapshot, createSimulationZones, rotatingSimulationZones, simulationTemperatureGrid } from "../model/viewerSimulation.js";

const EMPTY = [];

const STATUS_PRIORITY = { DANGER: 4, WARNING: 3, NORMAL: 2, IDLE: 1, EMPTY: 0 };

export default function useViewerSimulation({ allowed, equipment, equipmentId, modelVersion, rois, sensors }) {
  const [active, setActive] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [pattern, setPattern] = useState("1");
  const [manualZoneIds, setManualZoneIds] = useState([]);
  const [selectedRoiId, setSelectedRoiId] = useState("");
  const [levelDb, setLevelDb] = useState(68);
  const [averageTemperature, setAverageTemperature] = useState(48);
  const [cameraTemperatures, setCameraTemperatures] = useState({});
  const [peakHz, setPeakHz] = useState(32000);
  const [gaugeValue, setGaugeValue] = useState(65);
  const [alternateState, setAlternateState] = useState(false);
  const [ledColor, setLedColor] = useState("GREEN");
  const [pulse, setPulse] = useState({ sequence: 0, measuredAt: null, values: null, activeZoneIds: [] });
  const [alarm, setAlarm] = useState(null);
  const [now, setNow] = useState(Date.now);
  const rotationRef = useRef(0);
  const scoped = useMemo(() => rois.filter((roi) => roi.equipmentId === equipmentId), [rois, equipmentId]);
  const zones = useMemo(() => createSimulationZones(equipment, scoped), [equipment, scoped]);
  const thermalCameras = useMemo(() => sensors.filter((sensor) => getSensorCapabilities(sensor).includes("THERMAL")
    && (sensor.textureProjection?.equipmentId ?? sensor.equipmentIds?.[0]) === equipmentId)
    .map((sensor, index, all) => ({ id: sensor.id, name: sensor.name?.trim() || `열화상 카메라 ${index + 1}`,
      identifier: sensor.serialNumber || sensor.serverSensorId || sensor.id,
      projectionEnabled: sensor.textureProjection?.enabled && sensor.textureProjection.kind === "THERMAL",
      averageTemperature: cameraTemperatures[sensor.id] ?? 48 + (index - (all.length - 1) / 2) * 6,
      index })), [sensors, equipmentId, cameraTemperatures]);
  const projectedThermalCount = thermalCameras.length;
  const setCameraTemperature = (id, value) => {
    if (!Number.isFinite(value)) return;
    setCameraTemperatures((current) => ({ ...current, [id]: Math.max(-40, Math.min(250, value)) }));
  };
  const targetId = scoped.some((roi) => roi.id === selectedRoiId) ? selectedRoiId : scoped[0]?.id ?? "";
  const values = { levelDb, averageTemperature, peakHz, gaugeValue, alternateState, ledColor };
  const inject = () => {
    const activeZoneIds = rotatingSimulationZones(zones, pattern, rotationRef.current, manualZoneIds);
    if (!activeZoneIds.length) return;
    if (pattern !== "MANUAL") rotationRef.current = (rotationRef.current + 1) % zones.length;
    setPulse((current) => ({ sequence: current.sequence + 1, measuredAt: new Date().toISOString(), values, activeZoneIds }));
  };
  const quiet = () => setPulse((current) => ({ ...current, activeZoneIds: [] }));

  useEffect(() => {
    if (!allowed || !active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [allowed, active]);
  useEffect(() => {
    if (!allowed || !active || !automatic || (pattern === "MANUAL" && !manualZoneIds.length)) return undefined;
    const fire = () => {
      const activeZoneIds = rotatingSimulationZones(zones, pattern, rotationRef.current, manualZoneIds);
      if (pattern !== "MANUAL") rotationRef.current = (rotationRef.current + 1) % zones.length;
      setPulse((current) => ({ sequence: current.sequence + 1, measuredAt: new Date().toISOString(),
        values: { levelDb, averageTemperature, peakHz, gaugeValue, alternateState, ledColor }, activeZoneIds }));
    };
    fire();
    let illuminate = false;
    const timer = setInterval(() => {
      if (illuminate) fire();
      else quiet();
      illuminate = !illuminate;
    }, 1500);
    return () => clearInterval(timer);
  }, [allowed, active, automatic, zones, pattern, manualZoneIds, levelDb, averageTemperature, peakHz, gaugeValue, alternateState, ledColor]);
  useEffect(() => {
    if (!allowed || !active || automatic || !pulse.activeZoneIds.length) return undefined;
    const timer = setTimeout(quiet, 1500);
    return () => clearTimeout(timer);
  }, [allowed, active, automatic, pulse]);

  const grid = useMemo(() => pulse.values ? simulationTemperatureGrid(pulse.values.averageTemperature, pulse.sequence) : null,
    [pulse.values, pulse.sequence]);
  const thermalGrids = useMemo(() => active ? Object.fromEntries(thermalCameras.map((camera) => [camera.id,
    simulationTemperatureGrid(camera.averageTemperature, pulse.sequence, camera.index)])) : {},
  [active, thermalCameras, pulse.sequence]);
  const cameraReadouts = useMemo(() => thermalCameras.map((camera) => ({ ...camera,
    summary: temperatureSummary(thermalGrids[camera.id]) })), [thermalCameras, thermalGrids]);
  const snapshot = useMemo(() => !allowed || !active || !pulse.measuredAt ? null : createSimulationSnapshot({
    equipmentId, modelVersion, rois: scoped, selectedRoiId: targetId, sensors, zones,
    activeZoneIds: pulse.activeZoneIds, temperatureGrid: grid, thermalGrids,
    ...pulse.values, sequence: pulse.sequence, measuredAt: pulse.measuredAt, alarm,
  }), [allowed, active, pulse, equipmentId, modelVersion, scoped, targetId, sensors, zones, grid, thermalGrids, alarm]);
  const zoneStatuses = useMemo(() => zones.map((zone) => {
    const assessments = scoped.filter((roi) => zone.roiIds.includes(roi.id) && isObservationRoi(roi)).map((roi) => {
      const row = observationReadings(roiToObservationPoint(roi), sensors, snapshot?.readings ?? EMPTY, now)
        .find((item) => item.metric === "ultrasound.db");
      return { roiId: roi.id, name: roi.name, value: row?.value ?? null, state: observationStatus(row ? [row] : []).level };
    });
    const state = assessments.reduce((worst, item) => STATUS_PRIORITY[item.state] > STATUS_PRIORITY[worst] ? item.state : worst, "EMPTY");
    return { ...zone, active: pulse.activeZoneIds.includes(zone.id), assessments, state,
      levelDb: assessments.find((item) => Number.isFinite(item.value))?.value ?? null };
  }), [zones, scoped, sensors, snapshot, now, pulse.activeZoneIds]);
  const triggerAlarm = (severity) => {
    const measuredAt = new Date().toISOString();
    setAlarm((current) => ({ sequence: (current?.sequence ?? 0) + 1, severity, measuredAt }));
    setPulse((current) => ({ sequence: current.sequence + 1, measuredAt, values, activeZoneIds: current.activeZoneIds }));
  };
  const clear = () => { setAutomatic(false); setPulse((current) => ({ ...current, measuredAt: null, values: null, activeZoneIds: [] })); setAlarm(null); };
  const telemetry = active ? { textures: EMPTY, hotspots: snapshot?.hotspots ?? EMPTY, readings: snapshot?.readings ?? EMPTY,
    alarms: snapshot?.alarms ?? EMPTY, status: "DEMO", error: "", demo: true, simulated: true, now,
    acknowledge: async () => setAlarm(null), simulateAlarm: () => triggerAlarm("WARNING") } : null;
  return { allowed, active, setActive, automatic, setAutomatic, pattern, setPattern, manualZoneIds, setManualZoneIds,
    scoped, zones, zoneStatuses, projectedThermalCount, thermalCameras: cameraReadouts, setCameraTemperature, targetId, setSelectedRoiId,
    levelDb, setLevelDb, averageTemperature, setAverageTemperature, peakHz, setPeakHz,
    gaugeValue, setGaugeValue, alternateState, setAlternateState, ledColor, setLedColor,
    pulse, snapshot, telemetry, inject, triggerAlarm, clear };
}
