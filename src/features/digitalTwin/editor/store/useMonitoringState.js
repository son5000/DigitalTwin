import { getEnclosureSurfaces } from "../model/equipmentEnclosure";
import { useCallback, useEffect, useMemo, useState } from "react";
import { readProjects } from "../../../portal/projects/projectRepository.js";
import { LAYOUT_STORAGE_KEY } from "../model/layoutInitialization.js";

import {
  ASSET_SOURCE_TYPES, ASSET_TYPES, ASSET_USAGE_TYPES,
  createCabinetSampleBindings, createEquipmentAssetBinding, createId,
  isCabinetEquipment, normalizeEquipmentDetailSnapshot,
  normalizeObservationPoint, normalizeSensorBinding,
} from "@/features/digitalTwin/editor/model/equipmentDetailModel";

export default function useMonitoringState({ equipment }) {
  const [observationPoints, setObservationPoints] = useState([]);
  const [projectId] = useState(() => readProjects().activeId);
  useEffect(() => {
    function sync(event) {
      if (event.type === "digital-twin-roi-change") {
        if (event.detail.projectId !== projectId) return;
        const { point, removedId } = event.detail;
        setObservationPoints((points) => point ? [...points.filter((item) => item.id !== point.id), normalizeObservationPoint(point)] : points.filter((item) => item.id !== removedId));
        return;
      }
      if (event.key !== LAYOUT_STORAGE_KEY || readProjects().activeId !== projectId || !event.newValue) return;
      try {
        const before = JSON.parse(event.oldValue || "{}"), after = JSON.parse(event.newValue);
        const oldPoints = before.observationConfig?.observationPoints ?? before.observationPoints ?? [];
        const newPoints = after.observationConfig?.observationPoints ?? after.observationPoints ?? [];
        const changed = newPoints.filter((point) => JSON.stringify(point) !== JSON.stringify(oldPoints.find((item) => item.id === point.id)));
        const removed = oldPoints.filter((point) => !newPoints.some((item) => item.id === point.id));
        setObservationPoints((points) => {
          const next = points.filter((point) => !removed.some((item) => item.id === point.id && (item.revision ?? 0) >= point.revision));
          for (const point of changed) {
            const index = next.findIndex((item) => item.id === point.id);
            if (index < 0) next.push(normalizeObservationPoint(point));
            else if ((point.revision ?? 0) > next[index].revision) next[index] = normalizeObservationPoint(point);
          }
          return next;
        });
      } catch { /* Keep the current editor document if another tab writes invalid data. */ }
    }
    window.addEventListener("digital-twin-roi-change", sync); window.addEventListener("storage", sync);
    return () => { window.removeEventListener("digital-twin-roi-change", sync); window.removeEventListener("storage", sync); };
  }, [projectId]);
  const [sensorBindings, setSensorBindings] = useState([]);
  const [serverBindings, setServerBindings] = useState([]);
  const [equipmentAssetBindings, setEquipmentAssetBindings] = useState([]);
  const [selectedObservationPointId, setSelectedObservationPointId] = useState(null);
  const [selectedSensorBindingId, setSelectedSensorBindingId] = useState(null);
  const [selectedServerBindingId, setSelectedServerBindingId] = useState(null);
  const [selectedAssetBindingId, setSelectedAssetBindingId] = useState(null);

  const equipmentIdKey = JSON.stringify(equipment.map((item) => item.id).sort());
  const equipmentIds = useMemo(() => new Set(JSON.parse(equipmentIdKey)), [equipmentIdKey]);
  const activeObservationPoints = useMemo(() => observationPoints.filter((item) => equipmentIds.has(item.equipmentId)), [observationPoints, equipmentIds]);
  const activeSensorBindings = useMemo(() => sensorBindings.filter((item) => item.equipmentIds.some((id) => equipmentIds.has(id))), [sensorBindings, equipmentIds]);
  const activeServerBindings = useMemo(() => serverBindings.filter((item) => equipmentIds.has(item.equipmentId)), [serverBindings, equipmentIds]);
  const activeAssetBindings = useMemo(() => equipmentAssetBindings.filter((item) => equipmentIds.has(item.equipmentId)), [equipmentAssetBindings, equipmentIds]);
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
    setEquipmentAssetBindings((items) => [...items.filter((item) => !([ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(binding.assetType)
      && item.equipmentId === equipmentId && [ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(item.assetType))), binding]);
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
      id, equipmentId, targetPartId: null, name: `관측 영역 ${items.filter((item) => item.equipmentId === equipmentId).length + 1}`,
      description: "", localPosition, targetNormal: { x: 0, y: 0, z: 1 }, sensorIds: [], metric: "TEMPERATURE", unit: "°C",
      normalRange: { min: 0, max: 60 }, warningRange: { min: 60, max: 80 }, dangerRange: { min: 80, max: 120 },
    })]);
    setSelectedObservationPointId(id);
    return id;
  }, []);

  const updateObservationPoint = useCallback((id, changes) => setObservationPoints((items) => items.map((item) => item.id === id ? normalizeObservationPoint({
    ...item, ...changes, revision: (item.revision ?? 0) + 1,
    localPosition: changes.localPosition ? { ...item.localPosition, ...changes.localPosition } : item.localPosition,
    targetNormal: changes.targetNormal ? { ...item.targetNormal, ...changes.targetNormal } : item.targetNormal,
    normalRange: changes.normalRange ? { ...item.normalRange, ...changes.normalRange } : item.normalRange,
    warningRange: changes.warningRange ? { ...item.warningRange, ...changes.warningRange } : item.warningRange,
    dangerRange: changes.dangerRange ? { ...item.dangerRange, ...changes.dangerRange } : item.dangerRange,
  }) : item)), []);

  const removeObservationPoint = useCallback((id) => {
    setObservationPoints((items) => items.filter((item) => item.id !== id));
    setServerBindings((items) => items.map((item) => item.observationPointId === id ? { ...item, observationPointId: null } : item));
    setSensorBindings((items) => items.map((item) => ({ ...item, observationPointIds: item.observationPointIds?.filter((value) => value !== id) })));
    setSelectedObservationPointId((current) => current === id ? null : current);
  }, []);

  const addMonitoringDevice = useCallback((equipmentId, sourceType = "SENSOR", requestedCount = 1) => {
    if (!equipmentId) return null;
    const count = Math.max(1, Math.min(50, Math.floor(Number(requestedCount) || 1)));
    const host = equipment.find((item) => item.id === equipmentId);
    const surface = getEnclosureSurfaces(host)[0];
    const additions = Array.from({ length: count }, (_, index) => normalizeSensorBinding({
      id: createId("SENSOR_BINDING"), equipmentIds: [equipmentId], sensorType: sourceType, sourceType,
      name: sourceType === "CAMERA" ? "비전 카메라" : "센서", serverKey: "", mountMode: "EQUIPMENT",
      surfaceMount: surface ? { equipmentId, surfaceId: surface.id, u: surface.width * (index + 1) / (count + 1), v: surface.height / 2, offset: .025 } : null,
      position: { x: 0, y: (host?.dimensions?.height ?? 2) / 2, z: (host?.dimensions?.depth ?? 1) / 2 + .025 }, rotation: { x: 0, y: 0, z: 0 }, fieldOfView: 50, aspectRatio: 16 / 9, near: 0.1, far: 10,
    }));
    setSensorBindings((items) => [...items, ...additions.map((sensor, index) => ({ ...sensor, name: `${sensor.name} ${items.filter((item) => item.equipmentIds.includes(equipmentId)).length + index + 1}` }))]);
    setSelectedSensorBindingId(additions[0].id);
    return additions[0].id;
  }, [equipment]);

  const updateMonitoringDevice = useCallback((id, changes) => setSensorBindings((items) => items.map((item) => item.id === id ? normalizeSensorBinding({
    ...item, ...changes,
    sensorType: changes.sourceType ?? changes.sensorType ?? item.sensorType,
    calibrationConfirmed: ["surfaceMount", "position", "rotation", "mountMode", "fieldOfView", "aspectRatio", "near", "far", "capabilities"].some((key) => key in changes) ? false : changes.calibrationConfirmed ?? item.calibrationConfirmed,
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
    const normalized = normalizeEquipmentDetailSnapshot(snapshot.observationConfig ?? snapshot);
    setEquipmentAssetBindings(normalized.equipmentAssetBindings); setSensorBindings(normalized.sensorBindings);
    setObservationPoints(normalized.observationPoints); setServerBindings(normalized.serverBindings);
    setSelectedAssetBindingId(null); setSelectedSensorBindingId(null); setSelectedObservationPointId(null); setSelectedServerBindingId(null);
  }, []);

  const resetMonitoringState = useCallback(() => {
    setEquipmentAssetBindings([]); setSensorBindings([]); setObservationPoints([]); setServerBindings([]);
    setSelectedAssetBindingId(null); setSelectedSensorBindingId(null); setSelectedObservationPointId(null); setSelectedServerBindingId(null);
  }, []);

  const removeEquipmentMonitoringData = useCallback((removedIds = []) => {
    const equipmentIds = new Set(removedIds);
    setEquipmentAssetBindings((items) => items.filter((item) => !equipmentIds.has(item.equipmentId)));
    setObservationPoints((items) => items.filter((item) => !equipmentIds.has(item.equipmentId)));
    setServerBindings((items) => items.filter((item) => !equipmentIds.has(item.equipmentId)));
    setSensorBindings((items) => items
      .map((item) => ({ ...item, equipmentIds: item.equipmentIds.filter((id) => !equipmentIds.has(id)) }))
      .filter((item) => item.equipmentIds.length));
    setSelectedAssetBindingId(null);
    setSelectedObservationPointId(null);
    setSelectedSensorBindingId(null);
    setSelectedServerBindingId(null);
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
      addObservationPoint, updateObservationPoint, removeObservationPoint, selectObservationPoint: setSelectedObservationPointId,
      addMonitoringDevice, updateMonitoringDevice, selectMonitoringDevice: setSelectedSensorBindingId,
      addMonitoringBinding, updateMonitoringBinding, selectMonitoringBinding: setSelectedServerBindingId,
      hydrateMonitoringState, resetMonitoringState, removeEquipmentMonitoringData,
    },
  };
}
