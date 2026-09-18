function buildingFloors(layout, sourceFloorId) {
  const source = layout.hierarchy.nodes.find((node) => node.type === "FLOOR" && node.id === sourceFloorId);
  return source ? layout.hierarchy.nodes.filter((node) => node.type === "FLOOR" && node.parentId === source.parentId)
    .sort((left, right) => Number(left.level) - Number(right.level)) : [];
}

// Move the floor identity, so rooms, equipment and their saved bindings stay together.
export function moveFloorContents(layout, sourceFloorId, targetFloorId) {
  const floors = buildingFloors(layout, sourceFloorId);
  const sourceIndex = floors.findIndex((floor) => floor.id === sourceFloorId);
  const targetIndex = floors.findIndex((floor) => floor.id === targetFloorId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return layout;
  const reordered = [...floors];
  reordered.splice(targetIndex, 0, ...reordered.splice(sourceIndex, 1));
  const slots = new Map(reordered.map((floor, index) => [floor.id, floors[index]]));
  return { ...layout, hierarchy: { ...layout.hierarchy, nodes: layout.hierarchy.nodes.map((node) => {
    const slot = slots.get(node.id);
    return !slot || slot.id === node.id ? node : { ...node, name: slot.name, level: slot.level,
      elevation: slot.elevation, floorHeight: slot.floorHeight, isBasement: slot.isBasement };
  }) } };
}

function floorRooms(layout, floorId) {
  return layout.hierarchy.nodes.filter((node) => node.type === "ROOM" && node.parentId === floorId);
}

function localVerticalStructure(structure, floorId) {
  const scope = structure.applicationScope;
  return (structure.scope === "FLOOR" || scope?.mode === "CURRENT")
    && (structure.fromFloorId ?? structure.floorId ?? scope?.startFloorId) === floorId;
}

function remapCopy(value, ids, key = "") {
  if (Array.isArray(value)) return value.map((item) => remapCopy(item, ids, key));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .map(([name, item]) => [name, name === "batchGroupId" ? null : remapCopy(item, ids, name)]));
  return typeof value === "string" && (key === "id" || /Ids?$/.test(key)) ? ids.get(value) ?? value : value;
}

export function copyFloorContents(layout, sourceFloorId, targetFloorIds) {
  const floors = buildingFloors(layout, sourceFloorId);
  const targets = [...new Set(targetFloorIds)].filter((id) => id !== sourceFloorId && floors.some((floor) => floor.id === id));
  if (!targets.length) return layout;
  const buildingId = floors[0].parentId;
  const sourcePlan = layout.floorPlansById[sourceFloorId] ?? { floorId: sourceFloorId, structures: [] };
  const sourceEquipment = layout.equipmentByFloorId[sourceFloorId] ?? [];
  const sourceRooms = floorRooms(layout, sourceFloorId);
  const vertical = layout.verticalStructuresByBuildingId?.[buildingId] ?? [];
  const sourceVertical = vertical.filter((item) => localVerticalStructure(item, sourceFloorId));
  const sourceScenes = sourceRooms.map((room) => layout.roomScenes?.[room.id] ?? {});
  const sourceEquipmentIds = new Set([...sourceEquipment, ...sourceScenes.flatMap((scene) => scene.equipment ?? [])].map((item) => item.id));
  const targetRooms = targets.flatMap((id) => floorRooms(layout, id));
  const removedRoomIds = new Set(targetRooms.map((room) => room.id));
  const removedEquipmentIds = new Set([
    ...targets.flatMap((id) => layout.equipmentByFloorId[id] ?? []),
    ...targetRooms.flatMap((room) => layout.roomScenes?.[room.id]?.equipment ?? []),
  ].map((item) => item.id));
  const next = { ...layout,
    hierarchy: { ...layout.hierarchy, nodes: layout.hierarchy.nodes.filter((node) => !removedRoomIds.has(node.id)) },
    floorPlansById: { ...layout.floorPlansById }, equipmentByFloorId: { ...layout.equipmentByFloorId },
    roomScenes: Object.fromEntries(Object.entries(layout.roomScenes ?? {}).filter(([id]) => !removedRoomIds.has(id))),
    verticalStructuresByBuildingId: { ...layout.verticalStructuresByBuildingId, [buildingId]: vertical
      .filter((item) => !targets.some((id) => localVerticalStructure(item, id))) },
    equipmentAssetBindings: (layout.equipmentAssetBindings ?? []).filter((item) => !removedEquipmentIds.has(item.equipmentId)),
    observationPoints: (layout.observationPoints ?? []).filter((item) => !removedEquipmentIds.has(item.equipmentId)),
    serverBindings: (layout.serverBindings ?? []).filter((item) => !removedEquipmentIds.has(item.equipmentId)),
    sensorBindings: (layout.sensorBindings ?? []).map((item) => ({ ...item,
      equipmentIds: item.equipmentIds.filter((id) => !removedEquipmentIds.has(id)) })).filter((item) => item.equipmentIds.length),
  };
  const sourceOverrides = layout.viewerPreset?.equipmentRepresentation?.overrides ?? {};
  const overrides = Object.fromEntries(Object.entries(sourceOverrides).filter(([id]) => !removedEquipmentIds.has(id)));
  targets.forEach((floorId) => {
    const ids = new Map([[sourceFloorId, floorId]]);
    const entities = [sourcePlan.floorFootprint, ...(sourcePlan.floorFootprint?.regions ?? []),
      ...["elevationZones", "rooms", "walls", "doors", "structures"].flatMap((key) => sourcePlan[key] ?? []),
      ...sourceEquipment, ...sourceRooms, ...sourceVertical,
      ...sourceScenes.flatMap((scene) => ["equipment", "worldStructures", "pipeConnections", "detailAssets"].flatMap((key) => scene[key] ?? [])),
    ];
    entities.forEach((item) => { if (item?.id && !ids.has(item.id)) ids.set(item.id, `COPY_${crypto.randomUUID()}`); });
    next.floorPlansById[floorId] = { ...remapCopy(sourcePlan, ids), floorId };
    next.equipmentByFloorId[floorId] = sourceEquipment.map((item) => ({ ...remapCopy(item, ids), floorId }));
    next.hierarchy.nodes.push(...sourceRooms.map((room) => remapCopy(room, ids)));
    sourceRooms.forEach((room, index) => { next.roomScenes[ids.get(room.id)] = remapCopy(sourceScenes[index], ids); });
    next.verticalStructuresByBuildingId[buildingId].push(...sourceVertical.map((item) => remapCopy(item, ids)));
    (layout.equipmentAssetBindings ?? []).filter((item) => sourceEquipmentIds.has(item.equipmentId)).forEach((item) => {
      next.equipmentAssetBindings.push({ ...remapCopy(item, ids), id: `ASSET_BINDING_${crypto.randomUUID()}` });
    });
    sourceEquipmentIds.forEach((id) => { if (sourceOverrides[id]) overrides[ids.get(id)] = sourceOverrides[id]; });
  });
  if (removedRoomIds.has(next.hierarchy.activeRoomId)) next.hierarchy.activeRoomId = null;
  if (removedRoomIds.has(next.hierarchy.selectedNodeId)) next.hierarchy.selectedNodeId = targets[0];
  if (layout.viewerPreset) next.viewerPreset = { ...layout.viewerPreset, equipmentRepresentation: {
    ...layout.viewerPreset.equipmentRepresentation, overrides,
  } };
  next.observationConfig = { ...layout.observationConfig, equipmentAssetBindings: next.equipmentAssetBindings,
    sensorBindings: next.sensorBindings, observationPoints: next.observationPoints, serverBindings: next.serverBindings };
  return next;
}
