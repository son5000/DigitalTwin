import { useCallback, useMemo, useState } from "react";

import { UNIFIED_EQUIPMENT_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/unifiedEquipmentCatalog";
import { getBuildingFootprint } from "@/features/digitalTwin/editor/utils/buildingFootprint";
import { clampDimension } from "@/features/digitalTwin/editor/utils/editorMath";
import { normalizeEquipmentInstance } from "@/features/digitalTwin/editor/utils/templateParameters";
import { getFloorHeightAtPoint } from "@/features/digitalTwin/editor/model/floorSpatialModel";

function createId(prefix) { return `${prefix}_${crypto.randomUUID()}`; }

function mergeEquipment(equipment, changes) {
  return {
    ...equipment,
    ...changes,
    dimensions: changes.dimensions
      ? Object.fromEntries(Object.entries({ ...equipment.dimensions, ...changes.dimensions }).map(([key, value]) => [key, clampDimension(value)]))
      : equipment.dimensions,
    position: changes.position ? { ...equipment.position, ...changes.position } : equipment.position,
    rotation: changes.rotation ? { ...equipment.rotation, ...changes.rotation } : equipment.rotation,
    appearance: changes.appearance ? { ...equipment.appearance, ...changes.appearance } : equipment.appearance,
    appearanceSlots: changes.appearanceSlots
      ? Object.fromEntries([...new Set([...Object.keys(equipment.appearanceSlots ?? {}), ...Object.keys(changes.appearanceSlots)])].map((slotId) => [
          slotId,
          { ...equipment.appearanceSlots?.[slotId], ...changes.appearanceSlots[slotId] },
        ]))
      : equipment.appearanceSlots,
    metadata: changes.metadata ? { ...equipment.metadata, ...changes.metadata } : equipment.metadata,
  };
}

function constrainEquipment(equipment, building, gridSize, floorPlan) {
  if (!building) return equipment;
  const footprint = getBuildingFootprint(building);
  const rotation = equipment.rotation?.y ?? 0;
  const halfWidth = (Math.abs(Math.cos(rotation)) * equipment.dimensions.width + Math.abs(Math.sin(rotation)) * equipment.dimensions.depth) / 2;
  const halfDepth = (Math.abs(Math.sin(rotation)) * equipment.dimensions.width + Math.abs(Math.cos(rotation)) * equipment.dimensions.depth) / 2;
  const xLimit = Math.max(0, footprint.width / 2 - halfWidth);
  const zLimit = Math.max(0, footprint.depth / 2 - halfDepth);
  const spacing = Math.max(0.1, Number(gridSize) || 1);
  const snappedPosition = {
    x: Math.min(xLimit, Math.max(-xLimit, Math.round(equipment.position.x / spacing) * spacing)),
    z: Math.min(zLimit, Math.max(-zLimit, Math.round(equipment.position.z / spacing) * spacing)),
  };
  const floorHeight = getFloorHeightAtPoint(floorPlan?.elevationZones, snappedPosition);
  return {
    ...equipment,
    position: {
      ...snappedPosition,
      y: equipment.groundSnap === false ? Math.max(floorHeight, Number(equipment.position.y) || 0) : floorHeight,
    },
  };
}

function toPlacementEquipment(equipment) {
  const placementEquipment = { ...equipment };
  delete placementEquipment.dataBindings;
  delete placementEquipment.operationalState;
  delete placementEquipment.control;
  return placementEquipment;
}

export default function useFloorEquipmentState({ buildings, floors, currentBuilding, currentFloor, gridSettings, floorPlansById = {} }) {
  const [equipmentByFloorId, setEquipmentByFloorId] = useState({});
  const [selectedFloorEquipmentId, setSelectedFloorEquipmentId] = useState(null);
  const [activeFloorEquipmentTemplateId, setActiveFloorEquipmentTemplateId] = useState(null);
  const activeBuildingId = currentFloor?.parentId ?? currentBuilding?.id ?? null;
  const buildingFloorIds = useMemo(
    () => new Set(floors.filter((floor) => floor.parentId === activeBuildingId).map((floor) => floor.id)),
    [activeBuildingId, floors],
  );
  const resolvedEquipmentByFloorId = useMemo(() => Object.fromEntries(Object.entries(equipmentByFloorId).map(([floorId, items]) => [
    floorId,
    items.map((equipment) => {
      if (equipment.groundSnap === false) return equipment;
      const floorHeight = getFloorHeightAtPoint(floorPlansById[floorId]?.elevationZones, equipment.position);
      if (Math.abs((Number(equipment.position?.y) || 0) - floorHeight) < 0.0001) return equipment;
      return { ...equipment, position: { ...equipment.position, y: floorHeight } };
    }),
  ])), [equipmentByFloorId, floorPlansById]);
  const activeFloorEquipment = useMemo(
    () => resolvedEquipmentByFloorId[currentFloor?.id] ?? [],
    [currentFloor?.id, resolvedEquipmentByFloorId],
  );
  const buildingEquipment = useMemo(
    () => Object.entries(resolvedEquipmentByFloorId).filter(([floorId]) => buildingFloorIds.has(floorId)).flatMap(([, items]) => items),
    [buildingFloorIds, resolvedEquipmentByFloorId],
  );
  const allFloorEquipment = useMemo(() => Object.values(resolvedEquipmentByFloorId).flat(), [resolvedEquipmentByFloorId]);
  const selectedFloorEquipment = allFloorEquipment.find((item) => item.id === selectedFloorEquipmentId) ?? null;

  const selectFloorEquipmentTemplate = useCallback((templateId) => {
    setActiveFloorEquipmentTemplateId((current) => current === templateId ? null : templateId);
    setSelectedFloorEquipmentId(null);
  }, []);

  const addFloorEquipment = useCallback((templateId, position, context = {}) => {
    const template = UNIFIED_EQUIPMENT_TEMPLATE_MAP[templateId];
    const sourceFloor = floors.find((floor) => floor.id === context.floorId) ?? currentFloor;
    const targetFloorIds = (context.targetFloorIds?.length ? context.targetFloorIds : [sourceFloor?.id]).filter(Boolean);
    const batchGroupId = targetFloorIds.length > 1 ? createId("EQUIPMENT_BATCH") : null;
    if (!template || !sourceFloor || targetFloorIds.length === 0) return [];
    const createdIds = targetFloorIds.map(() => createId("FLOOR_EQUIPMENT"));
    setEquipmentByFloorId((collections) => {
      const next = { ...collections };
      targetFloorIds.forEach((floorId, targetIndex) => {
        const targetFloor = floors.find((floor) => floor.id === floorId);
        if (!targetFloor) return;
        const building = buildings.find((item) => item.id === targetFloor.parentId);
        const sequence = allFloorEquipment.filter((item) => item.sourceTemplateId === templateId).length + targetIndex + 1;
        const id = createdIds[targetIndex];
        const equipment = toPlacementEquipment(constrainEquipment(normalizeEquipmentInstance({
          id,
          name: `${template.nameKo} ${String(sequence).padStart(2, "0")}`,
          shapeTemplateId: template.id,
          sourceTemplateId: template.id,
          batchGroupId,
          floorId,
          spaceId: context.spaceId ?? null,
          position,
          metadata: { assetTag: "", manufacturer: "", model: "", serialNumber: "" },
          visible: true,
          locked: false,
        }, template), building, gridSettings.baseSize, floorPlansById[floorId]));
        next[floorId] = [...(next[floorId] ?? []), equipment];
      });
      return next;
    });
    return createdIds;
  }, [allFloorEquipment, buildings, currentFloor, floorPlansById, floors, gridSettings.baseSize]);

  const updateFloorEquipment = useCallback((equipmentId, changes) => {
    setEquipmentByFloorId((collections) => {
      let updated = null;
      let sourceFloorId = null;
      Object.entries(collections).some(([floorId, items]) => {
        const equipment = items.find((item) => item.id === equipmentId);
        if (!equipment) return false;
        sourceFloorId = floorId;
        const targetFloor = floors.find((item) => item.id === (changes.floorId ?? floorId));
        const building = buildings.find((item) => item.id === targetFloor?.parentId);
        updated = constrainEquipment(mergeEquipment(equipment, changes), building, gridSettings.baseSize, floorPlansById[targetFloor?.id]);
        return true;
      });
      if (!updated || !sourceFloorId) return collections;
      const targetFloorId = updated.floorId ?? sourceFloorId;
      if (targetFloorId === sourceFloorId) {
        return { ...collections, [sourceFloorId]: collections[sourceFloorId].map((item) => item.id === equipmentId ? updated : item) };
      }
      return {
        ...collections,
        [sourceFloorId]: collections[sourceFloorId].filter((item) => item.id !== equipmentId),
        [targetFloorId]: [...(collections[targetFloorId] ?? []), updated],
      };
    });
  }, [buildings, floorPlansById, floors, gridSettings.baseSize]);

  const removeSelectedFloorEquipment = useCallback(() => {
    if (!selectedFloorEquipmentId) return;
    setEquipmentByFloorId((collections) => Object.fromEntries(Object.entries(collections).map(([floorId, items]) => [
      floorId, items.filter((item) => item.id !== selectedFloorEquipmentId),
    ])));
    setSelectedFloorEquipmentId(null);
  }, [selectedFloorEquipmentId]);

  const duplicateSelectedFloorEquipment = useCallback(() => {
    if (!selectedFloorEquipment) return null;
    const id = createId("FLOOR_EQUIPMENT");
    const duplicate = {
      ...structuredClone(selectedFloorEquipment), id, name: `${selectedFloorEquipment.name} 복사본`, batchGroupId: null,
      position: { ...selectedFloorEquipment.position, x: selectedFloorEquipment.position.x + Math.max(0.5, gridSettings.baseSize) },
    };
    setEquipmentByFloorId((collections) => ({
      ...collections,
      [duplicate.floorId]: [...(collections[duplicate.floorId] ?? []), duplicate],
    }));
    setSelectedFloorEquipmentId(id);
    return id;
  }, [gridSettings.baseSize, selectedFloorEquipment]);

  const hydrateFloorEquipmentState = useCallback((snapshot = {}) => {
    setEquipmentByFloorId(Object.fromEntries(Object.entries(snapshot.equipmentByFloorId ?? {}).map(([floorId, items]) => [
      floorId,
      (items ?? []).map((equipment) => {
        const template = UNIFIED_EQUIPMENT_TEMPLATE_MAP[equipment.shapeTemplateId];
        return template ? normalizeEquipmentInstance({ ...equipment, floorId: equipment.floorId ?? floorId }, template) : null;
      }).filter(Boolean),
    ])));
    setSelectedFloorEquipmentId(null);
    setActiveFloorEquipmentTemplateId(null);
  }, []);

  const resetFloorEquipmentState = useCallback(() => {
    setEquipmentByFloorId({});
    setSelectedFloorEquipmentId(null);
    setActiveFloorEquipmentTemplateId(null);
  }, []);

  return {
    equipmentByFloorId,
    activeFloorEquipment,
    buildingEquipment,
    allFloorEquipment,
    selectedFloorEquipment,
    selectedFloorEquipmentId,
    activeFloorEquipmentTemplateId,
    actions: {
      selectFloorEquipmentTemplate,
      addFloorEquipment,
      updateFloorEquipment,
      selectFloorEquipment: setSelectedFloorEquipmentId,
      removeSelectedFloorEquipment,
      duplicateSelectedFloorEquipment,
      hydrateFloorEquipmentState,
      resetFloorEquipmentState,
    },
  };
}
