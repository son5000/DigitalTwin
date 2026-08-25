import { useCallback, useMemo, useState } from "react";

import { EQUIPMENT_SHAPE_TEMPLATE_MAP } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { getBuildingFootprint } from "@/features/digitalTwin/editor/utils/buildingFootprint";
import { clampDimension } from "@/features/digitalTwin/editor/utils/editorMath";
import { normalizeEquipmentInstance } from "@/features/digitalTwin/editor/utils/templateParameters";

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
    metadata: changes.metadata ? { ...equipment.metadata, ...changes.metadata } : equipment.metadata,
  };
}

function constrainEquipment(equipment, building, gridSize) {
  if (!building) return equipment;
  const footprint = getBuildingFootprint(building);
  const rotation = equipment.rotation?.y ?? 0;
  const halfWidth = (Math.abs(Math.cos(rotation)) * equipment.dimensions.width + Math.abs(Math.sin(rotation)) * equipment.dimensions.depth) / 2;
  const halfDepth = (Math.abs(Math.sin(rotation)) * equipment.dimensions.width + Math.abs(Math.cos(rotation)) * equipment.dimensions.depth) / 2;
  const xLimit = Math.max(0, footprint.width / 2 - halfWidth);
  const zLimit = Math.max(0, footprint.depth / 2 - halfDepth);
  const spacing = Math.max(0.1, Number(gridSize) || 1);
  return {
    ...equipment,
    position: {
      x: Math.min(xLimit, Math.max(-xLimit, Math.round(equipment.position.x / spacing) * spacing)),
      y: Math.max(0, Number(equipment.position.y) || 0),
      z: Math.min(zLimit, Math.max(-zLimit, Math.round(equipment.position.z / spacing) * spacing)),
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

export default function useFloorEquipmentState({ buildings, floors, currentBuilding, currentFloor, gridSettings }) {
  const [equipmentByFloorId, setEquipmentByFloorId] = useState({});
  const [selectedFloorEquipmentId, setSelectedFloorEquipmentId] = useState(null);
  const [activeFloorEquipmentTemplateId, setActiveFloorEquipmentTemplateId] = useState(null);
  const activeBuildingId = currentFloor?.parentId ?? currentBuilding?.id ?? null;
  const buildingFloorIds = useMemo(
    () => new Set(floors.filter((floor) => floor.parentId === activeBuildingId).map((floor) => floor.id)),
    [activeBuildingId, floors],
  );
  const activeFloorEquipment = useMemo(
    () => equipmentByFloorId[currentFloor?.id] ?? [],
    [currentFloor?.id, equipmentByFloorId],
  );
  const buildingEquipment = useMemo(
    () => Object.entries(equipmentByFloorId).filter(([floorId]) => buildingFloorIds.has(floorId)).flatMap(([, items]) => items),
    [buildingFloorIds, equipmentByFloorId],
  );
  const allFloorEquipment = useMemo(() => Object.values(equipmentByFloorId).flat(), [equipmentByFloorId]);
  const selectedFloorEquipment = allFloorEquipment.find((item) => item.id === selectedFloorEquipmentId) ?? null;

  const selectFloorEquipmentTemplate = useCallback((templateId) => {
    setActiveFloorEquipmentTemplateId((current) => current === templateId ? null : templateId);
    setSelectedFloorEquipmentId(null);
  }, []);

  const addFloorEquipment = useCallback((templateId, position, context = {}) => {
    const template = EQUIPMENT_SHAPE_TEMPLATE_MAP[templateId];
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
        }, template), building, gridSettings.baseSize));
        next[floorId] = [...(next[floorId] ?? []), equipment];
      });
      return next;
    });
    return createdIds;
  }, [allFloorEquipment, buildings, currentFloor, floors, gridSettings.baseSize]);

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
        updated = constrainEquipment(mergeEquipment(equipment, changes), building, gridSettings.baseSize);
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
  }, [buildings, floors, gridSettings.baseSize]);

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
    },
  };
}
