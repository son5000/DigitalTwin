import { useCallback, useMemo, useState } from "react";

import {
  ASSET_SOURCE_TYPES, ASSET_TYPES, ASSET_USAGE_TYPES,
  createCabinetSampleBindings, createEquipmentAssetBinding, createId,
  isCabinetEquipment, normalizeEquipmentDetailSnapshot,
  normalizeObservationPoint, normalizeSensorBinding,
} from "@/features/digitalTwin/editor/model/equipmentDetailModel";

export default function useMonitoringState({ equipment }) {
  const [observationPoints, setObservationPoints] = useState([]);
  const [sensorBindings, setSensorBindings] = useState([]);
  const [serverBindings, setServerBindings] = useState([]);
  const [equipmentAssetBindings, setEquipmentAssetBindings] = useState([]);
  const [selectedObservationPointId, setSelectedObservationPointId] = useState(null);
  const [selectedSensorBindingId, setSelectedSensorBindingId] = useState(null);
  const [selectedServerBindingId, setSelectedServerBindingId] = useState(null);
  const [selectedAssetBindingId, setSelectedAssetBindingId] = useState(null);

  const equipmentIds = useMemo(() => new Set(equipment.map((item) => item.id)), [equipment]);
  const activeObservationPoints = observationPoints.filter((item) => equipmentIds.has(item.equipmentId));
  const activeSensorBindings = sensorBindings.filter((item) => item.equipmentIds.some((id) => equipmentIds.has(id)));
  const activeServerBindings = serverBindings.filter((item) => equipmentIds.has(item.equipmentId));
  const activeAssetBindings = equipmentAssetBindings.filter((item) => equipmentIds.has(item.equipmentId));
  const selectedObservationPoint = activeObservationPoints.find((item) => item.id === selectedObservationPointId) ?? null;
  const selectedSensorBinding = activeSensorBindings.find((item) => item.id === selectedSensorBindingId) ?? null;
  const selectedServerBinding = activeServerBindings.find((item) => item.id === selectedServerBindingId) ?? null;
  const selectedAssetBinding = activeAssetBindings.find((item) => item.id === selectedAssetBindingId) ?? null;

  const ensureEquipmentDetail = useCallback((targetEquipment) => {
    if (!targetEquipment || !isCabinetEquipment(targetEquipment)) return;
    setEquipmentAssetBindings((items) => {
      if (items.some((item) => item.equipmentId === targetEquipment.id)) return items;
      const created = createCabinetSampleBindings(targetEquipment.id);
      setSelectedAssetBindingId(created[0]?.id ?? null);
      return [...items, ...created];
    });
  }, []);

  const addAssetBinding = useCallback((equipmentId, source = {}) => {
    if (!equipmentId) return null;
    const extension = (source.fileName ?? source.sourceKey ?? "").split(".").pop()?.toUpperCase();
    const assetType = source.assetType ?? ({ OBJ: ASSET_TYPES.OBJ, PLY: ASSET_TYPES.PLY, JPG: ASSET_TYPES.IMAGE, JPEG: ASSET_TYPES.IMAGE, PNG: ASSET_TYPES.IMAGE }[extension] ?? "UNSUPPORTED");
    const usageType = source.usageType ?? (assetType === ASSET_TYPES.PLY ? ASSET_USAGE_TYPES.POINT_CLOUD : assetType === ASSET_TYPES.IMAGE ? ASSET_USAGE_TYPES.REFERENCE_IMAGE : ASSET_USAGE_TYPES.MODEL);
    const binding = createEquipmentAssetBinding(equipmentId, source, {
      ...source, assetType, usageType,
      sourceType: source.sourceType ?? ASSET_SOURCE_TYPES.UPLOAD,
      status: assetType === "UNSUPPORTED" ? "UNSUPPORTED" : source.status ?? "READY",
    });
    setEquipmentAssetBindings((items) => [...items, binding]);
    setSelectedAssetBindingId(binding.id);
    return binding.id;
  }, []);

  const updateAssetBinding = useCallback((id, changes) => setEquipmentAssetBindings((items) => items.map((item) => item.id === id ? {
    ...item, ...changes,
    alignmentTransform: changes.alignmentTransform ? {
      ...item.alignmentTransform, ...changes.alignmentTransform,
      position: { ...item.alignmentTransform.position, ...changes.alignmentTransform.position },
      rotation: { ...item.alignmentTransform.rotation, ...changes.alignmentTransform.rotation },
      scale: { ...item.alignmentTransform.scale, ...changes.alignmentTransform.scale },
    } : item.alignmentTransform,
  } : item)), []);

  const addObservationPoint = useCallback((equipmentId, localPosition = { x: 0, y: 0.5, z: 0 }) => {
    if (!equipmentId) return null;
    const id = createId("OBSERVATION_POINT");
    setObservationPoints((items) => [...items, normalizeObservationPoint({
      id, equipmentId, targetPartId: null, name: `관측 포인트 ${items.filter((item) => item.equipmentId === equipmentId).length + 1}`,
      description: "", localPosition, targetNormal: { x: 0, y: 0, z: 1 }, sensorIds: [], metric: "TEMPERATURE", unit: "°C",
      normalRange: { min: 0, max: 60 }, warningRange: { min: 60, max: 80 }, dangerRange: { min: 80, max: 120 },
    })]);
    setSelectedObservationPointId(id);
    return id;
  }, []);

  const updateObservationPoint = useCallback((id, changes) => setObservationPoints((items) => items.map((item) => item.id === id ? normalizeObservationPoint({
    ...item, ...changes,
    localPosition: changes.localPosition ? { ...item.localPosition, ...changes.localPosition } : item.localPosition,
    targetNormal: changes.targetNormal ? { ...item.targetNormal, ...changes.targetNormal } : item.targetNormal,
    normalRange: changes.normalRange ? { ...item.normalRange, ...changes.normalRange } : item.normalRange,
    warningRange: changes.warningRange ? { ...item.warningRange, ...changes.warningRange } : item.warningRange,
    dangerRange: changes.dangerRange ? { ...item.dangerRange, ...changes.dangerRange } : item.dangerRange,
  }) : item)), []);

  const addMonitoringDevice = useCallback((equipmentId, sourceType = "SENSOR") => {
    if (!equipmentId) return null;
    const id = createId("SENSOR_BINDING");
    const sensor = normalizeSensorBinding({
      id, equipmentIds: [equipmentId], sensorType: sourceType, sourceType,
      name: sourceType === "CAMERA" ? "비전 카메라" : "센서", serverKey: "", mountMode: "WORLD",
      position: { x: 2, y: 2, z: 2 }, rotation: { x: 0, y: -0.7, z: 0 }, fieldOfView: 50, aspectRatio: 16 / 9, near: 0.1, far: 10,
    });
    setSensorBindings((items) => [...items, sensor]);
    setSelectedSensorBindingId(id);
    return id;
  }, []);

  const updateMonitoringDevice = useCallback((id, changes) => setSensorBindings((items) => items.map((item) => item.id === id ? normalizeSensorBinding({
    ...item, ...changes,
    sensorType: changes.sourceType ?? changes.sensorType ?? item.sensorType,
    position: changes.position ? { ...item.position, ...changes.position } : item.position,
    rotation: changes.rotation ? { ...item.rotation, ...changes.rotation } : item.rotation,
  }) : item)), []);

  const addMonitoringBinding = useCallback((input) => {
    const { equipmentId, observationPointId = null, targetPartId = null, sourceDeviceId, metric = "TEMPERATURE", unit = "°C" } = input;
    if (!equipmentId || !sourceDeviceId) return null;
    const device = sensorBindings.find((item) => item.id === sourceDeviceId);
    const id = createId("SERVER_BINDING");
    setServerBindings((items) => [...items, {
      id, equipmentId, observationPointId, targetPartId, metric, unit, sourceDeviceId, sourceType: device?.sensorType ?? "SENSOR",
      serverKey: device?.serverKey ?? "", protocol: device?.sensorType === "CAMERA" ? "RTSP" : "MQTT", endpoint: "", topicOrPath: "", valuePath: "$.value",
      pollingInterval: 1000, transform: "value", normalRange: { min: 0, max: 60 }, warningRange: { min: 60, max: 80 }, dangerRange: { min: 80, max: 120 }, enabled: true,
    }]);
    setObservationPoints((items) => items.map((point) => point.id === observationPointId ? { ...point, sensorIds: [...new Set([...(point.sensorIds ?? []), sourceDeviceId])] } : point));
    setSensorBindings((items) => items.map((sensor) => sensor.id === sourceDeviceId ? { ...sensor, observationPointIds: [...new Set([...(sensor.observationPointIds ?? []), observationPointId].filter(Boolean))] } : sensor));
    setSelectedServerBindingId(id);
    return id;
  }, [sensorBindings]);

  const updateMonitoringBinding = useCallback((id, changes) => setServerBindings((items) => items.map((item) => item.id === id ? {
    ...item, ...changes,
    normalRange: changes.normalRange ? { ...item.normalRange, ...changes.normalRange } : item.normalRange,
    warningRange: changes.warningRange ? { ...item.warningRange, ...changes.warningRange } : item.warningRange,
    dangerRange: changes.dangerRange ? { ...item.dangerRange, ...changes.dangerRange } : item.dangerRange,
  } : item)), []);

  const hydrateMonitoringState = useCallback((snapshot = {}) => {
    const normalized = normalizeEquipmentDetailSnapshot(snapshot);
    setEquipmentAssetBindings(normalized.equipmentAssetBindings); setSensorBindings(normalized.sensorBindings);
    setObservationPoints(normalized.observationPoints); setServerBindings(normalized.serverBindings);
    setSelectedAssetBindingId(null); setSelectedSensorBindingId(null); setSelectedObservationPointId(null); setSelectedServerBindingId(null);
  }, []);

  const resetMonitoringState = useCallback(() => {
    setEquipmentAssetBindings([]); setSensorBindings([]); setObservationPoints([]); setServerBindings([]);
    setSelectedAssetBindingId(null); setSelectedSensorBindingId(null); setSelectedObservationPointId(null); setSelectedServerBindingId(null);
  }, []);

  return {
    equipmentAssetBindings: activeAssetBindings, sensorBindings: activeSensorBindings,
    observationPoints: activeObservationPoints, serverBindings: activeServerBindings,
    monitoringDevices: activeSensorBindings, monitoringBindings: activeServerBindings,
    selectedAssetBinding, selectedObservationPoint, selectedSensorBinding, selectedServerBinding,
    selectedMonitoringDevice: selectedSensorBinding, selectedMonitoringBinding: selectedServerBinding,
    actions: {
      ensureEquipmentDetail,
      addAssetBinding, updateAssetBinding, selectAssetBinding: setSelectedAssetBindingId,
      addObservationPoint, updateObservationPoint, selectObservationPoint: setSelectedObservationPointId,
      addMonitoringDevice, updateMonitoringDevice, selectMonitoringDevice: setSelectedSensorBindingId,
      addMonitoringBinding, updateMonitoringBinding, selectMonitoringBinding: setSelectedServerBindingId,
      hydrateMonitoringState, resetMonitoringState,
    },
  };
}
