// Read-only list of placed equipment. Editing always goes back to its saved owner.
export function collectMonitoringEquipment({ floorEquipment = [], roomScenes = {}, activeRoomId, roomEquipment = [], siteObjects = [], hierarchy = [], templates = {} }) {
  const result = new Map();
  const nodes = new Map(hierarchy.map((node) => [node.id, node]));
  function location(id) {
    const labels = [];
    const seen = new Set();
    while (id && !seen.has(id)) {
      seen.add(id); const node = nodes.get(id); if (!node) break;
      labels.unshift(node.name); id = node.parentId;
    }
    return labels.join(" / ");
  }
  function add(item, source, ownerId) {
    if (!item?.id || result.has(item.id)) return;
    const templateId = item.shapeTemplateId || item.type;
    const template = templates[templateId];
    if (source === "SITE" && !template) return;
    result.set(item.id, {
      ...item, shapeTemplateId: templateId,
      position: { x: 0, y: 0, z: 0, ...item.position }, rotation: { x: 0, y: 0, z: 0, ...item.rotation },
      dimensions: { ...template?.defaultDimensions, ...item.dimensions }, appearance: { ...template?.defaultAppearance, ...item.appearance },
      monitoringSource: source, monitoringOwnerId: ownerId,
      locationLabel: source === "SITE" ? "외부 설비" : location(item.roomId || item.floorId || ownerId) || "소속 미지정",
    });
  }
  floorEquipment.forEach((item) => add(item, "FLOOR", item.floorId));
  Object.entries(roomScenes).forEach(([roomId, scene]) => (roomId === activeRoomId ? roomEquipment : scene.equipment || []).forEach((item) => add(item, "ROOM", roomId)));
  roomEquipment.forEach((item) => add(item, "ROOM", activeRoomId));
  siteObjects.forEach((item) => add(item, "SITE", item.parentId));
  return [...result.values()];
}
