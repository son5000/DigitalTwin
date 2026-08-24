import { useCallback, useMemo, useState } from "react";

function createId(prefix) { return `${prefix}_${crypto.randomUUID()}`; }

export default function useMonitoringState({ equipment }) {
  const [observationPoints, setObservationPoints] = useState([]);
  const [monitoringDevices, setMonitoringDevices] = useState([]);
  const [monitoringBindings, setMonitoringBindings] = useState([]);
  const [selectedObservationPointId, setSelectedObservationPointId] = useState(null);
  const [selectedMonitoringDeviceId, setSelectedMonitoringDeviceId] = useState(null);
  const [selectedMonitoringBindingId, setSelectedMonitoringBindingId] = useState(null);

  const selectedObservationPoint = observationPoints.find((item) => item.id === selectedObservationPointId) ?? null;
  const selectedMonitoringDevice = monitoringDevices.find((item) => item.id === selectedMonitoringDeviceId) ?? null;
  const selectedMonitoringBinding = monitoringBindings.find((item) => item.id === selectedMonitoringBindingId) ?? null;
  const equipmentIds = useMemo(() => new Set(equipment.map((item) => item.id)), [equipment]);
  const activeObservationPoints = observationPoints.filter((item) => equipmentIds.has(item.equipmentId));
  const activeBindings = monitoringBindings.filter((item) => equipmentIds.has(item.equipmentId));

  const addObservationPoint = useCallback((equipmentId, localPosition = { x: 0, y: 0.5, z: 0 }) => {
    if (!equipmentId) return null;
    const id = createId("OBSERVATION_POINT");
    setObservationPoints((items) => [...items, {
      id, equipmentId, targetPartId: null, name: `관측 지점 ${items.filter((item) => item.equipmentId === equipmentId).length + 1}`,
      description: "", localPosition, metric: "TEMPERATURE", unit: "°C",
      normalRange: { min: 0, max: 60 }, warningRange: { min: 60, max: 80 }, dangerRange: { min: 80, max: 120 },
    }]);
    setSelectedObservationPointId(id);
    return id;
  }, []);

  const updateObservationPoint = useCallback((id, changes) => setObservationPoints((items) => items.map((item) => item.id === id ? {
    ...item, ...changes,
    localPosition: changes.localPosition ? { ...item.localPosition, ...changes.localPosition } : item.localPosition,
    normalRange: changes.normalRange ? { ...item.normalRange, ...changes.normalRange } : item.normalRange,
    warningRange: changes.warningRange ? { ...item.warningRange, ...changes.warningRange } : item.warningRange,
    dangerRange: changes.dangerRange ? { ...item.dangerRange, ...changes.dangerRange } : item.dangerRange,
  } : item)), []);

  const addMonitoringDevice = useCallback((equipmentId, sourceType = "SENSOR") => {
    if (!equipmentId) return null;
    const id = createId("MONITORING_DEVICE");
    setMonitoringDevices((items) => [...items, {
      id, equipmentId, sourceType, name: sourceType === "CAMERA" ? "카메라" : "센서", identifier: "",
      position: { x: 2, y: 2, z: 2 }, rotation: { x: 0, y: 0, z: 0 }, range: 10, fov: 50,
    }]);
    setSelectedMonitoringDeviceId(id);
    return id;
  }, []);

  const updateMonitoringDevice = useCallback((id, changes) => setMonitoringDevices((items) => items.map((item) => item.id === id ? {
    ...item, ...changes,
    position: changes.position ? { ...item.position, ...changes.position } : item.position,
    rotation: changes.rotation ? { ...item.rotation, ...changes.rotation } : item.rotation,
  } : item)), []);

  const addMonitoringBinding = useCallback(({ equipmentId, observationPointId = null, targetPartId = null, sourceDeviceId, metric = "TEMPERATURE", unit = "°C" }) => {
    if (!equipmentId || !sourceDeviceId) return null;
    const device = monitoringDevices.find((item) => item.id === sourceDeviceId);
    const id = createId("MONITORING_BINDING");
    setMonitoringBindings((items) => [...items, {
      id, equipmentId, observationPointId, targetPartId, metric, unit, sourceDeviceId, sourceType: device?.sourceType ?? "SENSOR",
      protocol: device?.sourceType === "CAMERA" ? "RTSP" : "MQTT", endpoint: "", topicOrPath: "", valuePath: "$.value",
      pollingInterval: 1000, transform: "value", normalRange: { min: 0, max: 60 }, warningRange: { min: 60, max: 80 }, dangerRange: { min: 80, max: 120 }, enabled: true,
    }]);
    setSelectedMonitoringBindingId(id);
    return id;
  }, [monitoringDevices]);

  const updateMonitoringBinding = useCallback((id, changes) => setMonitoringBindings((items) => items.map((item) => item.id === id ? {
    ...item, ...changes,
    normalRange: changes.normalRange ? { ...item.normalRange, ...changes.normalRange } : item.normalRange,
    warningRange: changes.warningRange ? { ...item.warningRange, ...changes.warningRange } : item.warningRange,
    dangerRange: changes.dangerRange ? { ...item.dangerRange, ...changes.dangerRange } : item.dangerRange,
  } : item)), []);

  return {
    observationPoints: activeObservationPoints, monitoringDevices, monitoringBindings: activeBindings,
    selectedObservationPoint, selectedMonitoringDevice, selectedMonitoringBinding,
    actions: {
      addObservationPoint, updateObservationPoint, selectObservationPoint: setSelectedObservationPointId,
      addMonitoringDevice, updateMonitoringDevice, selectMonitoringDevice: setSelectedMonitoringDeviceId,
      addMonitoringBinding, updateMonitoringBinding, selectMonitoringBinding: setSelectedMonitoringBindingId,
    },
  };
}
