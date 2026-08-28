import { createBuildingFootprint } from "./buildingTemplates.js";

export const BUILDING_ENTITY_TYPES = Object.freeze({ MASS: "mass", CONNECTOR: "connector", VOID: "void" });
export const BUILDING_VIEW_MODES = Object.freeze({ ALL: "ALL", HIGHLIGHT: "HIGHLIGHT", GHOST_OTHERS: "GHOST_OTHERS", HIDE_OTHERS: "HIDE_OTHERS" });
export const CONNECTOR_TYPES = Object.freeze(["corridor", "bridge", "glass-bridge", "skybridge", "shared-floor", "atrium"]);

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function rectangle(width = 20, depth = 14) {
  return createBuildingFootprint("RECTANGLE", width, depth);
}

export function createCircleFootprint(diameter = 16, segments = 20) {
  const radius = diameter / 2;
  return {
    templateId: "CIRCLE",
    points: Array.from({ length: segments }, (_, index) => {
      const angle = index / segments * Math.PI * 2;
      return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
    }),
    holes: [],
  };
}

export function createUniformLevels(floorCount = 5, floorHeight = 3.6, baseElevation = 0) {
  return Array.from({ length: Math.max(1, Math.round(floorCount)) }, (_, index) => ({
    id: id("level"),
    name: `${index + 1}층`,
    floorNumber: index + 1,
    baseElevation: baseElevation + index * floorHeight,
    topElevation: baseElevation + (index + 1) * floorHeight,
    height: floorHeight,
    order: index,
  }));
}

export function createBuildingMassEntity({
  name = "새 매스",
  footprint = rectangle(),
  baseElevation = 0,
  topElevation = 18,
  position = { x: 0, y: 0, z: 0 },
  rotationY = 0,
  materialId = "facade-default",
  color = "#87979D",
  viewGroupIds = [],
  tags = [],
} = {}) {
  return {
    id: id("mass"), entityType: BUILDING_ENTITY_TYPES.MASS, name, tags,
    levelIds: [], viewGroupIds, visible: true, locked: false, translucent: false,
    materialId, color, footprint, verticalRange: { baseElevation, topElevation },
    transform: { position: { ...position }, rotationY },
  };
}

export function createBuildingConnectorEntity({
  name = "연결 통로", fromEntityId, toEntityId, levelId = null,
  connectorType = "glass-bridge", pathType = "straight", width = 3.2, height = 3,
  baseElevation = 0, topElevation = 3, materialId = "facade-default", viewGroupIds = [],
} = {}) {
  return {
    id: id("connector"), entityType: BUILDING_ENTITY_TYPES.CONNECTOR, name, tags: ["연결부"],
    levelIds: levelId ? [levelId] : [], viewGroupIds, visible: true, locked: false, translucent: false,
    connectorType,
    from: { entityId: fromEntityId, levelId, position: { x: 0, y: (baseElevation + topElevation) / 2, z: 0 }, mode: "auto" },
    to: { entityId: toEntityId, levelId, position: { x: 0, y: (baseElevation + topElevation) / 2, z: 0 }, mode: "auto" },
    path: { type: pathType, points: [] }, width, height,
    verticalRange: { baseElevation, topElevation },
    enclosure: { leftWall: true, rightWall: true, roof: true, floor: true },
    materialPreset: connectorType.includes("glass") ? "glass" : "steel", materialId,
  };
}

function levelsFromLegacy(source) {
  const sections = source.sections ?? [];
  const floorCount = Math.max(1, ...sections.map((section) => Number(section.endFloor) || 1));
  const heights = Array.from({ length: floorCount }, (_, index) => {
    const floor = index + 1;
    return sections.find((section) => floor >= section.startFloor && floor <= section.endFloor)?.floorHeight ?? source.floorHeight ?? 3.6;
  });
  let elevation = 0;
  return heights.map((height, index) => {
    const level = { id: id("level"), name: `${index + 1}층`, floorNumber: index + 1, baseElevation: elevation, topElevation: elevation + height, height, order: index };
    elevation += height;
    return level;
  });
}

function legacyMasses(source, levels) {
  return (source.sections ?? []).map((section, index) => {
    const served = levels.filter((level) => level.floorNumber >= section.startFloor && level.floorNumber <= section.endFloor);
    const mass = createBuildingMassEntity({
      name: section.name ?? (source.sections.length === 1 ? "본동" : `${index + 1}번 매스`),
      footprint: structuredClone(section.footprint),
      baseElevation: served[0]?.baseElevation ?? 0,
      topElevation: served.at(-1)?.topElevation ?? sectionFloorTop(section),
      position: { x: section.offset?.x ?? 0, y: 0, z: section.offset?.z ?? 0 },
      rotationY: section.rotation ?? 0,
      materialId: section.materialId,
      color: section.color,
    });
    mass.id = section.id || mass.id;
    mass.levelIds = served.map((level) => level.id);
    return mass;
  });
}

function sectionFloorTop(section) {
  return Math.max(0, Number(section.endFloor) - Number(section.startFloor) + 1) * (Number(section.floorHeight) || 3.6);
}

function normalizeLevel(level, index) {
  const baseElevation = Number(level.baseElevation) || 0;
  const topElevation = Math.max(baseElevation + 0.1, Number(level.topElevation) || baseElevation + Number(level.height) || 3.6);
  return { ...level, id: level.id || id("level"), name: String(level.name || `${index + 1}층`), floorNumber: level.floorNumber == null ? undefined : Number(level.floorNumber), baseElevation, topElevation, height: topElevation - baseElevation, order: Number.isFinite(level.order) ? level.order : index };
}

export function getMassWorldPoints(mass) {
  if (mass?.entityType !== BUILDING_ENTITY_TYPES.MASS) return [];
  const angle = Number(mass.transform?.rotationY || 0) * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const position = mass.transform?.position ?? { x: 0, z: 0 };
  return mass.footprint.points.map((point) => ({
    x: point.x * cosine - point.z * sine + Number(position.x || 0),
    z: point.x * sine + point.z * cosine + Number(position.z || 0),
  }));
}

export function getMassBounds(mass) {
  const points = getMassWorldPoints(mass);
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  return {
    minX: xs.length ? Math.min(...xs) : 0, maxX: xs.length ? Math.max(...xs) : 0,
    minZ: zs.length ? Math.min(...zs) : 0, maxZ: zs.length ? Math.max(...zs) : 0,
    center: { x: xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0, z: zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0 },
  };
}

function facingAnchor(mass, otherMass, y) {
  const bounds = getMassBounds(mass);
  const other = getMassBounds(otherMass).center;
  const dx = other.x - bounds.center.x;
  const dz = other.z - bounds.center.z;
  if (Math.abs(dx) >= Math.abs(dz)) return { x: dx >= 0 ? bounds.maxX : bounds.minX, y, z: bounds.center.z };
  return { x: bounds.center.x, y, z: dz >= 0 ? bounds.maxZ : bounds.minZ };
}

export function resolveConnectorPath(asset, connector) {
  const fromMass = asset.entities?.find((entity) => entity.id === connector.from?.entityId && entity.entityType === BUILDING_ENTITY_TYPES.MASS);
  const toMass = asset.entities?.find((entity) => entity.id === connector.to?.entityId && entity.entityType === BUILDING_ENTITY_TYPES.MASS);
  if (!fromMass || !toMass) return [];
  const y = (Number(connector.verticalRange?.baseElevation) + Number(connector.verticalRange?.topElevation)) / 2;
  const start = connector.from?.mode === "manual" ? connector.from.position : facingAnchor(fromMass, toMass, y);
  const end = connector.to?.mode === "manual" ? connector.to.position : facingAnchor(toMass, fromMass, y);
  if (connector.path?.type === "polyline" && connector.path.points?.length >= 2) return connector.path.points;
  if (connector.path?.type === "L") return [start, { x: end.x, y, z: start.z }, end];
  if (connector.path?.type === "U") {
    const offset = Math.max(connector.width * 2, 4);
    return [start, { x: start.x, y, z: start.z + offset }, { x: end.x, y, z: end.z + offset }, end];
  }
  return [start, end];
}

function syncMembership(entities, groups) {
  const membership = new Map(entities.map((entity) => [entity.id, []]));
  groups.forEach((group) => group.entityIds.forEach((entityId) => membership.get(entityId)?.push(group.id)));
  return entities.map((entity) => ({ ...entity, viewGroupIds: membership.get(entity.id) ?? [] }));
}

function massToLegacySection(mass, levels) {
  const served = levels.filter((level) => mass.levelIds.includes(level.id));
  const startFloor = served.length ? Math.min(...served.map((level) => level.floorNumber ?? level.order + 1)) : 1;
  const endFloor = served.length ? Math.max(...served.map((level) => level.floorNumber ?? level.order + 1)) : startFloor;
  const averageHeight = served.length ? served.reduce((sum, level) => sum + level.height, 0) / served.length : Math.max(0.1, mass.verticalRange.topElevation - mass.verticalRange.baseElevation);
  return {
    id: mass.id, name: mass.name, startFloor, endFloor, floorHeight: averageHeight,
    footprint: structuredClone(mass.footprint),
    offset: { x: mass.transform.position.x, z: mass.transform.position.z },
    rotation: mass.transform.rotationY, materialId: mass.materialId, color: mass.color,
  };
}

export function normalizeBuildingAssembly(source) {
  const levels = (source.levels?.length ? source.levels : levelsFromLegacy(source)).map(normalizeLevel).sort((a, b) => a.baseElevation - b.baseElevation || a.order - b.order).map((level, index) => ({ ...level, order: index }));
  let entities = source.entities?.length ? structuredClone(source.entities) : legacyMasses(source, levels);
  entities = entities.map((entity) => {
    const baseElevation = Number(entity.verticalRange?.baseElevation) || 0;
    const topElevation = Math.max(baseElevation + 0.1, Number(entity.verticalRange?.topElevation) || baseElevation + 3.6);
    const levelIds = levels.filter((level) => level.topElevation > baseElevation && level.baseElevation < topElevation).map((level) => level.id);
    return { tags: [], viewGroupIds: [], visible: true, locked: false, translucent: false, ...entity, levelIds, verticalRange: { baseElevation, topElevation } };
  });
  const entityIds = new Set(entities.map((entity) => entity.id));
  let viewGroups = source.viewGroups?.length ? structuredClone(source.viewGroups) : [{ id: id("group"), name: "전체 건축물", type: "whole", entityIds: [...entityIds], levelIds: levels.map((level) => level.id), displayMode: { selected: "normal", others: "normal" } }];
  viewGroups = viewGroups.map((group) => ({ ...group, entityIds: (group.entityIds ?? []).filter((entityId) => entityIds.has(entityId)), levelIds: (group.levelIds ?? []).filter((levelId) => levels.some((level) => level.id === levelId)), displayMode: { selected: "normal", others: "ghost", ...group.displayMode } }));
  const whole = viewGroups.find((group) => group.type === "whole");
  if (whole) whole.entityIds = [...entityIds];
  else viewGroups.unshift({ id: id("group"), name: "전체 건축물", type: "whole", entityIds: [...entityIds], levelIds: levels.map((level) => level.id), displayMode: { selected: "normal", others: "normal" } });
  entities = syncMembership(entities, viewGroups);
  const relations = (source.relations ?? []).filter((relation) => entityIds.has(relation.sourceEntityId) && entityIds.has(relation.targetEntityId));
  return {
    ...source,
    assemblyType: source.assemblyType ?? "COMPLEX_BUILDING",
    levels,
    entities,
    viewGroups,
    relations,
    defaultViewGroupId: viewGroups.some((group) => group.id === source.defaultViewGroupId) ? source.defaultViewGroupId : viewGroups[0].id,
    sections: entities.filter((entity) => entity.entityType === BUILDING_ENTITY_TYPES.MASS).map((mass) => massToLegacySection(mass, levels)),
  };
}

export function createComplexTowerAssembly(baseAsset) {
  const levels = createUniformLevels(20, 3.6);
  const lowTop = levels[9].topElevation;
  const upperTop = levels[19].topElevation;
  const a = createBuildingMassEntity({ name: "A동", footprint: rectangle(18, 16), baseElevation: 0, topElevation: lowTop, position: { x: -15, y: 0, z: 0 }, color: "#7D8F9A" });
  const b = createBuildingMassEntity({ name: "B동", footprint: rectangle(18, 16), baseElevation: 0, topElevation: lowTop, position: { x: 15, y: 0, z: 0 }, color: "#718792" });
  const shared = createBuildingMassEntity({ name: "11층 이상 공용 공간", footprint: rectangle(48, 18), baseElevation: lowTop, topElevation: upperTop, position: { x: 0, y: 0, z: 0 }, color: "#8296A1" });
  const fifth = levels[4];
  const connector = createBuildingConnectorEntity({ name: "5층 유리 연결 통로", fromEntityId: a.id, toEntityId: b.id, levelId: fifth.id, connectorType: "glass-bridge", baseElevation: fifth.baseElevation + 0.35, topElevation: fifth.topElevation - 0.35, width: 3.4, height: fifth.height - 0.7 });
  const entities = [a, b, connector, shared];
  const group = (name, type, entityIds, levelIds = []) => ({ id: id("group"), name, type, entityIds, levelIds, displayMode: { selected: "normal", others: "ghost" } });
  const viewGroups = [
    group("전체 건축물", "whole", entities.map((entity) => entity.id), levels.map((level) => level.id)),
    group("A동만", "wing", [a.id]), group("B동만", "wing", [b.id]),
    group("A동과 연결 통로", "custom", [a.id, connector.id]), group("B동과 연결 통로", "custom", [b.id, connector.id]),
    group("5층 전체", "floor", [a.id, b.id, connector.id], [fifth.id]), group("연결 통로만", "connector", [connector.id], [fifth.id]),
    group("11층 이상 공용 공간", "shared-space", [shared.id], levels.slice(10).map((level) => level.id)),
  ];
  const relations = [
    { id: id("relation"), type: "connects", sourceEntityId: connector.id, targetEntityId: a.id, metadata: { role: "from" } },
    { id: id("relation"), type: "connects", sourceEntityId: connector.id, targetEntityId: b.id, metadata: { role: "to" } },
    { id: id("relation"), type: "shared-by", sourceEntityId: shared.id, targetEntityId: a.id },
    { id: id("relation"), type: "shared-by", sourceEntityId: shared.id, targetEntityId: b.id },
  ];
  return normalizeBuildingAssembly({ ...baseAsset, name: "복합 연결 타워", category: "복합 건축물", levels, entities, viewGroups, relations, defaultViewGroupId: viewGroups[0].id });
}
