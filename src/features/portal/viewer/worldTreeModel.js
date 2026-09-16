export const WORLD_TREE_TYPES = Object.freeze({
  SITE: { label: "공간 구성", rootType: "SITE", placeholder: "/portal/workflow-site.svg" },
  BUILDING: { label: "건축물 중심", rootType: "BUILDING", placeholder: "/portal/workflow-building.svg" },
  MULTI_EQUIPMENT: { label: "다중 설비", rootType: "ROOM", placeholder: "/portal/workflow-sensors.svg" },
  SINGLE_EQUIPMENT: { label: "단일 설비", rootType: "EQUIPMENT", placeholder: "/portal/workflow-sensors.svg" },
});
const LABELS = { SITE: "부지", BUILDING: "건축물", FLOOR: "층", ROOM: "공간", EQUIPMENT: "설비", PART: "구성요소", SITE_OBJECT: "부지 객체" };
const EQUIPMENT_SITE_ASSET_KINDS = new Set(["OUTDOOR_EQUIPMENT", "CUSTOM_EQUIPMENT", "INDUSTRIAL", "ELECTRICAL", "LOGISTICS", "PIPE_TANK"]);
const list = (value) => Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" && item.id) : [];
const isEquipmentSiteObject = (item) => EQUIPMENT_SITE_ASSET_KINDS.has(item?.assetKind);
export const worldNodeKey = (type, id, equipmentId) => JSON.stringify([type, equipmentId ?? null, id]);

// A read-only projection of the saved relationships; never written back to the editor.
export function createWorldTree(layout = {}, resolveAsset = () => null) {
  const hierarchy = list(layout.hierarchy?.nodes);
  const hierarchyById = new Map(hierarchy.map((item) => [item.id, item]));
  const spatialOwner = (id) => ["ROOM", "FLOOR"].includes(hierarchyById.get(id)?.type) ? id : null;
  function equipmentOwner(item, containerId) {
    // Explicit saved ownership, collection ownership, then the hierarchy record.
    // A missing room can still resolve through floorId; never infer a floor by name.
    return spatialOwner(item.roomId) ?? spatialOwner(item.floorId) ?? spatialOwner(item.parentId)
      ?? spatialOwner(containerId) ?? spatialOwner(hierarchyById.get(item.id)?.parentId)
      ?? item.parentId ?? hierarchyById.get(item.id)?.parentId ?? null;
  }
  const equipmentEntries = new Map();
  const addEquipment = (items, parentId) => list(items).forEach((item) => {
    if (!equipmentEntries.has(item.id)) equipmentEntries.set(item.id, { item, parentId: equipmentOwner(item, parentId) });
  });
  Object.entries(layout.equipmentByFloorId ?? {}).forEach(([id, items]) => addEquipment(items, id));
  Object.entries(layout.roomScenes ?? {}).forEach(([id, scene]) => addEquipment(scene?.equipment, id));
  addEquipment(layout.equipment, layout.hierarchy?.activeRoomId);
  const equipment = [...equipmentEntries.values()].map(({ item }) => item);
  const buildings = hierarchy.filter((item) => item.type === "BUILDING" && !item.systemHost);
  const siteObjects = list(layout.siteObjects);
  const explicitScope = layout.observationWorkflow?.scopeType;
  const scope = Object.hasOwn(WORLD_TREE_TYPES, explicitScope) ? explicitScope
    : buildings.length > 1 || siteObjects.length ? "SITE"
      : buildings.length === 1 ? "BUILDING"
        : equipment.length === 1 ? "SINGLE_EQUIPMENT" : equipment.length > 1 ? "MULTI_EQUIPMENT" : "SITE";
  const config = WORLD_TREE_TYPES[scope];
  const nodes = new Map();
  const byId = new Map();
  const counters = {};
  function add(item, type, parentId, equipmentId) {
    const key = worldNodeKey(type, item.id, equipmentId);
    if (nodes.has(key)) return nodes.get(key);
    counters[type] = (counters[type] ?? 0) + 1;
    const node = { key, id: item.id, type, label: typeof item.name === "string" && item.name.trim() ? item.name : `${LABELS[type] ?? "항목"} ${counters[type]}`, item, parentId, equipmentId, children: [] };
    nodes.set(key, node);
    if (!equipmentId) byId.set(item.id, node);
    return node;
  }
  hierarchy.forEach((item) => {
    if (LABELS[item.type] && (item.type !== "SITE_OBJECT" || isEquipmentSiteObject(item))) {
      add(item, item.type, item.type === "EQUIPMENT" ? equipmentOwner(item) : item.parentId);
    }
  });
  const site = [...nodes.values()].find((node) => node.type === "SITE");
  siteObjects.filter((item) => isEquipmentSiteObject({ ...item, type: "SITE_OBJECT" }))
    .forEach((item) => add(item, "SITE_OBJECT", item.parentId ?? site?.id));
  equipmentEntries.forEach(({ item, parentId }) => {
    const node = add(item, "EQUIPMENT", parentId);
    // add() reuses stable keys: a hierarchy placeholder may already exist with an
    // outdated building-level parent. Apply the actual instance's saved ownership.
    node.parentId = parentId;
    node.item = item;
    const asset = resolveAsset(item.customAssetId) ?? item.customAssetSnapshot;
    node.asset = asset;
    list(asset?.parts ?? item.parts).forEach((part) => {
      const child = add(part, "PART", item.id, item.id);
      child.parentKey = node.key;
      if (!node.children.includes(child)) node.children.push(child);
    });
  });
  const settings = layout.observationWorkflow?.viewerSettings ?? {};
  const allNodes = [...nodes.values()];
  let root = scope === "SITE" ? site
    : scope === "BUILDING" ? allNodes.find((node) => node.type === "BUILDING" && node.id === settings.focusBuildingId) ?? allNodes.find((node) => node.type === "BUILDING")
      : scope === "SINGLE_EQUIPMENT" ? allNodes.find((node) => node.type === "EQUIPMENT" && node.id === settings.activeEquipmentId) ?? allNodes.find((node) => node.type === "EQUIPMENT")
        : null;
  if (scope === "MULTI_EQUIPMENT") {
    const hosts = [...equipmentEntries.values()].map(({ parentId }) => byId.get(parentId));
    // Only use a real space as the root when it contains every equipment instance.
    root = hosts.length && hosts.every((host) => host && host === hosts[0]) ? hosts[0] : null;
    if (root && !["ROOM", "FLOOR"].includes(root.type)) root = null;
    if (root?.type === "FLOOR") root.label = root.item.systemHost ? "설비 공간" : `${root.label} · 설비 공간`;
  }
  const roots = root ? [root] : [];
  const orphaned = [];
  const equipmentOnly = scope.includes("EQUIPMENT");
  for (const node of allNodes) {
    if (node === root || node.type === "PART") continue;
    if (equipmentOnly && !["EQUIPMENT"].includes(node.type)) continue;
    if (scope === "BUILDING" && node.type === "SITE") continue;
    let parent = byId.get(node.parentId);
    const visited = new Set([node.key]);
    let ancestor = parent;
    let connected = false;
    while (ancestor && !visited.has(ancestor.key)) {
      visited.add(ancestor.key);
      if (ancestor === root) { connected = true; break; }
      ancestor = byId.get(ancestor.parentId);
    }
    if (root && connected && (!equipmentOnly || parent === root)) {
      node.parentKey = parent.key;
      parent.children.push(node);
    } else orphaned.push(node);
  }
  if (!root && equipmentOnly && equipment.length) {
    // A display-only group, without inventing a persisted world object or ID.
    root = { key: "viewer:space", type: "ROOM", label: "공간 (미지정)", children: orphaned.splice(0), synthetic: true, selectable: true };
    root.children.forEach((node) => { node.parentKey = root.key; });
    nodes.set(root.key, root);
    roots.push(root);
  }
  if (orphaned.length) {
    const group = { key: "viewer:unclassified", label: "미분류", synthetic: true, children: orphaned };
    orphaned.forEach((node) => { node.parentKey = group.key; });
    nodes.set(group.key, group);
    roots.push(group);
  }
  const rootAsset = root?.asset ?? resolveAsset(root?.item?.customAssetId) ?? root?.item?.customAssetSnapshot;
  const thumbnail = [root?.item?.thumbnail, rootAsset?.thumbnail, layout.thumbnail].find((value) => typeof value === "string" && value.trim()) ?? null;
  return { scope, config, roots, nodes, hierarchy, equipment, siteObjects, thumbnail, root };
}

export function getTreeAncestors(tree, key) {
  const parents = [];
  const visited = new Set([key]);
  let current = tree.nodes.get(key);
  while (current?.parentKey && !visited.has(current.parentKey)) {
    visited.add(current.parentKey);
    parents.push(current.parentKey);
    current = tree.nodes.get(current.parentKey);
  }
  return parents;
}

export function toggleTreeNode(expanded, key) {
  const next = new Set(expanded);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

export function getViewerEquipmentContext(tree, node) {
  if (!node) return null;
  const owner = node.type === "PART" ? tree.nodes.get(worldNodeKey("EQUIPMENT", node.equipmentId)) : node;
  const outdoor = owner?.type === "SITE_OBJECT" && isEquipmentSiteObject(owner.item);
  if (owner?.type !== "EQUIPMENT" && !outdoor) return null;
  const ancestors = getTreeAncestors(tree, owner.key).map((key) => tree.nodes.get(key));
  return { node: owner, item: owner.item, outdoor, floor: ancestors.find((item) => item.type === "FLOOR"),
    building: ancestors.find((item) => item.type === "BUILDING") };
}
