import {
  BUILDING_OBJECT_DEFINITIONS,
  getDefaultObjectVariants,
} from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import { normalizeBuildingOpenings } from "@/features/digitalTwin/editor/model/buildingOpenings";

export const HIERARCHY_NODE_TYPES = Object.freeze({
  SITE: "SITE",
  BUILDING: "BUILDING",
  FLOOR: "FLOOR",
  ROOM: "ROOM",
});

export const HIERARCHY_CHILD_TYPES = Object.freeze({
  [HIERARCHY_NODE_TYPES.SITE]: HIERARCHY_NODE_TYPES.BUILDING,
  [HIERARCHY_NODE_TYPES.BUILDING]: HIERARCHY_NODE_TYPES.FLOOR,
  [HIERARCHY_NODE_TYPES.FLOOR]: HIERARCHY_NODE_TYPES.ROOM,
});

export const HIERARCHY_TYPE_LABELS = Object.freeze({
  [HIERARCHY_NODE_TYPES.SITE]: "부지",
  [HIERARCHY_NODE_TYPES.BUILDING]: "건축물",
  [HIERARCHY_NODE_TYPES.FLOOR]: "층",
  [HIERARCHY_NODE_TYPES.ROOM]: "공간",
});

export const BUILDING_TEMPLATES = Object.freeze(BUILDING_OBJECT_DEFINITIONS.map((definition) => ({
  id: definition.id,
  name: definition.name,
  roofType: definition.defaultVariants.roofStyle,
  definition,
})));

export const DEFAULT_BUILDING_DEFINITION = Object.freeze({
  templateId: "BUILDING",
  objectDefinitionId: "BUILDING",
  parameters: Object.freeze({ width: 24, depth: 16, floorCount: 5, floorHeight: 3.6, roofType: "FLAT", entranceCount: 2, stairCount: 2, extras: [] }),
  variants: Object.freeze(getDefaultObjectVariants(BUILDING_OBJECT_DEFINITIONS[0])),
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  appearance: Object.freeze({ color: "#9aa7ad", material: "CONCRETE" }),
  facadeOpenings: Object.freeze(normalizeBuildingOpenings({}, 5)),
});

export const DEFAULT_ROOM_LAYOUT = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  appearance: Object.freeze({ color: "#6f8f9d" }),
});

const DEFAULT_NODE_IDS = Object.freeze({
  SITE: "SITE_MAIN",
});

export function createDefaultHierarchy() {
  return {
    rootId: DEFAULT_NODE_IDS.SITE,
    activeRoomId: null,
    selectedNodeId: DEFAULT_NODE_IDS.SITE,
    nodes: [
      { id: DEFAULT_NODE_IDS.SITE, type: HIERARCHY_NODE_TYPES.SITE, name: "메인 부지", parentId: null },
    ],
  };
}

export function normalizeHierarchy(hierarchy) {
  if (!hierarchy || !Array.isArray(hierarchy.nodes)) return createDefaultHierarchy();

  const nodes = hierarchy.nodes
    .filter((node) => (
      node && typeof node.id === "string" && Object.values(HIERARCHY_NODE_TYPES).includes(node.type)
    ))
    .map((node) => {
      if (node.type === HIERARCHY_NODE_TYPES.BUILDING) {
        const normalizedNode = {
          ...DEFAULT_BUILDING_DEFINITION,
          ...node,
          parameters: { ...DEFAULT_BUILDING_DEFINITION.parameters, ...node.parameters },
          variants: { ...DEFAULT_BUILDING_DEFINITION.variants, ...node.variants },
          position: { ...DEFAULT_BUILDING_DEFINITION.position, ...node.position },
          rotation: { ...DEFAULT_BUILDING_DEFINITION.rotation, ...node.rotation },
          appearance: { ...DEFAULT_BUILDING_DEFINITION.appearance, ...node.appearance },
          facadeOpenings: normalizeBuildingOpenings(node.facadeOpenings ?? {
            doors: { count: node.parameters?.entranceCount, type: node.variants?.entranceStyle },
            windows: { type: node.variants?.windowStyle === "CURTAIN_WALL" ? "CURTAIN_WALL" : "FIXED" },
          }, Math.max(1, Number(node.parameters?.floorCount) || 1)),
        };
        delete normalizedNode.settingStatus;
        delete normalizedNode.detailSettingStatus;
        return normalizedNode;
      }
      if (node.type === HIERARCHY_NODE_TYPES.ROOM) {
        return {
          ...node,
          position: { ...DEFAULT_ROOM_LAYOUT.position, ...node.position },
          rotation: { ...DEFAULT_ROOM_LAYOUT.rotation, ...node.rotation },
          appearance: { ...DEFAULT_ROOM_LAYOUT.appearance, ...node.appearance },
        };
      }
      return node;
    });
  const siteNode = nodes.find((node) => node.type === HIERARCHY_NODE_TYPES.SITE && node.parentId === null);
  if (!siteNode) return createDefaultHierarchy();
  nodes.forEach((node) => {
    if (node.type !== HIERARCHY_NODE_TYPES.BUILDING) return;
    const storedFloorCount = nodes.filter(
      (candidate) => candidate.type === HIERARCHY_NODE_TYPES.FLOOR && candidate.parentId === node.id,
    ).length;
    node.parameters = {
      ...node.parameters,
      floorCount: Math.max(1, storedFloorCount || node.parameters.floorCount || 1),
    };
  });
  const roomIds = new Set(nodes.filter((node) => node.type === HIERARCHY_NODE_TYPES.ROOM).map((node) => node.id));
  const activeRoomId = roomIds.has(hierarchy.activeRoomId)
    ? hierarchy.activeRoomId
    : roomIds.values().next().value ?? null;

  return {
    rootId: nodes.some((node) => node.id === hierarchy.rootId) ? hierarchy.rootId : siteNode.id,
    activeRoomId,
    selectedNodeId: nodes.some((node) => node.id === hierarchy.selectedNodeId)
      ? hierarchy.selectedNodeId
      : activeRoomId ?? siteNode.id,
    nodes,
  };
}

export function getHierarchyPath(nodes, nodeId) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const path = [];
  let currentNode = nodeMap.get(nodeId);

  while (currentNode) {
    path.unshift(currentNode);
    currentNode = currentNode.parentId ? nodeMap.get(currentNode.parentId) : null;
  }

  return path;
}

export function getHierarchyDescendantIds(nodes, nodeId) {
  const descendants = new Set([nodeId]);
  let foundChild = true;

  while (foundChild) {
    foundChild = false;
    nodes.forEach((node) => {
      if (node.parentId && descendants.has(node.parentId) && !descendants.has(node.id)) {
        descendants.add(node.id);
        foundChild = true;
      }
    });
  }

  return descendants;
}

export function createHierarchyNode(type, parentId, siblingCount, overrides = {}) {
  const sequence = siblingCount + 1;
  const baseNode = {
    id: overrides.id ?? `${type}_${crypto.randomUUID()}`,
    type,
    name: `${HIERARCHY_TYPE_LABELS[type]} ${String(sequence).padStart(2, "0")}`,
    parentId,
  };

  if (type === HIERARCHY_NODE_TYPES.BUILDING) {
    Object.assign(baseNode, {
      ...DEFAULT_BUILDING_DEFINITION,
      parameters: { ...DEFAULT_BUILDING_DEFINITION.parameters },
      position: { ...DEFAULT_BUILDING_DEFINITION.position },
      rotation: { ...DEFAULT_BUILDING_DEFINITION.rotation },
      appearance: { ...DEFAULT_BUILDING_DEFINITION.appearance },
      variants: { ...DEFAULT_BUILDING_DEFINITION.variants },
    });
  }

  if (type === HIERARCHY_NODE_TYPES.FLOOR) {
    Object.assign(baseNode, {
      name: `${sequence}층`,
      level: sequence,
      elevation: (sequence - 1) * 4,
    });
  }

  if (type === HIERARCHY_NODE_TYPES.ROOM) {
    const columnOffsets = [0, 22, -22];
    Object.assign(baseNode, {
      name: `공간 ${String(sequence).padStart(2, "0")}`,
      position: {
        ...DEFAULT_ROOM_LAYOUT.position,
        x: columnOffsets[(sequence - 1) % columnOffsets.length],
        z: Math.floor((sequence - 1) / columnOffsets.length) * 18,
      },
      rotation: { ...DEFAULT_ROOM_LAYOUT.rotation },
      appearance: { ...DEFAULT_ROOM_LAYOUT.appearance },
    });
  }

  return { ...baseNode, ...overrides };
}
