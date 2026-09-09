import * as THREE from "three";

import { CUSTOM_ASSET_SCHEMA_VERSION, CUSTOM_ASSET_STATUS, CUSTOM_ASSET_TYPES, createCustomAssetId } from "../core/customAssetTypes.js";
import {
  EQUIPMENT_SHAPE_TEMPLATES as UNIFIED_EQUIPMENT_TEMPLATES,
} from "../../digitalTwin/editor/constants/equipmentShapeTemplates.js";

const PIPE_PART_LIBRARY = [
  ["PIPE_STRAIGHT", "직선 배관", { length: 2.4, diameter: 0.3, bendRadius: 0.6 }],
  ["PIPE_ELBOW_45", "45도 엘보", { length: 1.2, diameter: 0.3, bendRadius: 0.6 }],
  ["PIPE_ELBOW_90", "90도 엘보", { length: 1.2, diameter: 0.3, bendRadius: 0.6 }],
  ["PIPE_T", "T형 접합부", { length: 1.4, diameter: 0.3, branchLength: 0.8 }],
  ["PIPE_Y", "Y형 접합부", { length: 1.5, diameter: 0.3, branchLength: 0.9 }],
  ["PIPE_CROSS", "십자형 접합부", { length: 1.4, diameter: 0.3, branchLength: 1.4 }],
  ["PIPE_CONNECTOR", "배관 커넥터", { length: 0.45, diameter: 0.3 }],
  ["PIPE_CAP", "배관 마감 캡", { length: 0.25, diameter: 0.3 }],
  ["PIPE_REDUCER", "레듀서", { length: 0.75, diameter: 0.3, endDiameter: 0.2 }],
  ["PIPE_FLANGE", "플랜지", { length: 0.35, diameter: 0.3 }],
  ["PIPE_VALVE", "밸브", { length: 0.9, diameter: 0.3 }],
].map(([id, nameKo, parameters]) => ({
  id,
  nameKo,
  templateId: id,
  categoryId: "PIPING",
  partKind: "PIPE",
  parameters,
  thumbnailSource: `/assets/object-thumbnails/${id}.png`,
}));
export const CUSTOM_EQUIPMENT_CATEGORIES = Object.freeze([
  ["ALL", "전체"],
  ["ROTATING", "회전기기"],
  ["VESSEL", "탱크·용기"],
  ["PIPING", "배관·밸브"],
  ["HVAC", "공조·열설비"],
  ["ELECTRICAL", "전기설비"],
  ["INSTRUMENT", "계측·센서"],
].map(([id, nameKo]) => ({ id, nameKo })));

function workshopCategory(definition) {
  const key = `${definition.id} ${definition.modelFamilyId ?? ""} ${definition.category ?? ""}`.toUpperCase();
  if (/PIPE|VALVE|FLANGE|CONNECTOR|HOSE|REDUCER/.test(key)) return "PIPING";
  if (/TANK|VESSEL|SILO|HOPPER|DRUM/.test(key)) return "VESSEL";
  if (/PUMP|MOTOR|FAN|BLOWER|COMPRESSOR|GEARBOX|MIXER/.test(key)) return "ROTATING";
  if (/HEAT_EXCHANGER|CHILLER|BOILER|DUCT|AIR_TERMINAL|COOLING|CONDENSER/.test(key)) return "HVAC";
  if (/TRANSFORMER|PANEL|MCC|UPS|BATTERY|SWITCH|ELECTRICAL|JUNCTION/.test(key)) return "ELECTRICAL";
  if (/SENSOR|CAMERA|METER|GAUGE|INSTRUMENT/.test(key)) return "INSTRUMENT";
  return null;
}

const pipeIds = new Set(PIPE_PART_LIBRARY.map((item) => item.id));
const INDUSTRIAL_PART_LIBRARY = UNIFIED_EQUIPMENT_TEMPLATES.flatMap((definition) => {
  const categoryId = workshopCategory(definition);
  if (!categoryId || pipeIds.has(definition.id) || definition.generatorKey === "UNIFIED_OUTDOOR") return [];
  return [{
    ...definition,
    id: definition.id,
    nameKo: definition.nameKo ?? definition.name,
    templateId: definition.id,
    categoryId,
    partKind: categoryId === "PIPING" ? "PIPE" : "EQUIPMENT",
    parameters: definition.defaultParameters ?? definition.parameters ?? {},
    dimensions: definition.defaultDimensions ?? { width: definition.width, height: definition.height, depth: definition.depth },
    thumbnailSource: definition.thumbnailSource ?? `/assets/object-thumbnails/${definition.id}.png`,
  }];
});

export const CUSTOM_EQUIPMENT_PART_LIBRARY = Object.freeze([...PIPE_PART_LIBRARY, ...INDUSTRIAL_PART_LIBRARY]);

export const CUSTOM_EQUIPMENT_PART_MAP = Object.freeze(Object.fromEntries(CUSTOM_EQUIPMENT_PART_LIBRARY.map((item) => [item.id, item])));
export const CUSTOM_EQUIPMENT_DIRECTIONS = Object.freeze([
  ["N", "위", 0, -1], ["NE", "오른쪽 위", 1, -1], ["E", "오른쪽", 1, 0], ["SE", "오른쪽 아래", 1, 1],
  ["S", "아래", 0, 1], ["SW", "왼쪽 아래", -1, 1], ["W", "왼쪽", -1, 0], ["NW", "왼쪽 위", -1, -1],
].map(([id, label, x, z]) => ({ id, label, direction: { x: x / Math.hypot(x, z), y: 0, z: z / Math.hypot(x, z) } })));

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const vector = (value = {}, fallback = {}) => ({ x: finite(value.x, fallback.x), y: finite(value.y, fallback.y), z: finite(value.z, fallback.z) });

function normalizeDimensions(value = {}, fallback = {}) {
  return {
    width: Math.max(0.05, finite(value.width, fallback.width ?? 1)),
    height: Math.max(0.05, finite(value.height, fallback.height ?? 1)),
    depth: Math.max(0.05, finite(value.depth, fallback.depth ?? 1)),
  };
}

export function getCustomEquipmentPartDimensions(type, parameters = {}, dimensions = null) {
  const definition = CUSTOM_EQUIPMENT_PART_MAP[type] ?? CUSTOM_EQUIPMENT_PART_MAP.PIPE_STRAIGHT;
  if (definition.partKind !== "PIPE") return normalizeDimensions(dimensions, definition.dimensions);
  const length = Math.max(0.1, finite(parameters.length, 1)); const diameter = Math.max(0.02, finite(parameters.diameter, 0.2));
  const radius = Math.max(diameter, finite(parameters.bendRadius, length / 2)); const branch = Math.max(diameter, finite(parameters.branchLength, length / 2));
  if (type === "PIPE_ELBOW_90") return { width: radius + diameter, height: diameter, depth: radius + diameter };
  if (type === "PIPE_ELBOW_45") return { width: radius * 1.7 + diameter, height: diameter, depth: radius * 0.75 + diameter };
  if (["PIPE_T", "PIPE_Y", "PIPE_CROSS"].includes(type)) return { width: length, height: diameter, depth: branch };
  return { width: length, height: type === "PIPE_VALVE" ? diameter * 4.5 : diameter, depth: diameter };
}

function portSpecs(type, parameters, dimensions) {
  const definition = CUSTOM_EQUIPMENT_PART_MAP[type] ?? CUSTOM_EQUIPMENT_PART_MAP.PIPE_STRAIGHT;
  const { width, height, depth } = getCustomEquipmentPartDimensions(type, parameters, dimensions);
  const diameter = Math.max(0.02, finite(parameters.connectionDiameter ?? parameters.diameter, Math.min(width, depth) * 0.18));
  const port = (id, position, direction, role = "MAIN", size = diameter) => ({
    id, localPosition: position, direction, diameter: size, role, connectedTo: null, connectable: true,
  });
  if (definition.partKind !== "PIPE") {
    const key = `${type} ${definition.modelFamilyId ?? ""}`.toUpperCase();
    if (/TANK|VESSEL|SILO|HOPPER|DRUM/.test(key)) return [
      port("inlet", { x: 0, y: height * 0.72, z: -depth / 2 }, { x: 0, y: 0, z: -1 }, "INLET"),
      port("outlet", { x: width / 2, y: height * 0.2, z: 0 }, { x: 1, y: 0, z: 0 }, "OUTLET"),
    ];
    if (/PUMP|FAN|BLOWER|COMPRESSOR|HEAT_EXCHANGER|CHILLER|BOILER|CONDENSER/.test(key)) return [
      port("inlet", { x: -width / 2, y: height * 0.35, z: 0 }, { x: -1, y: 0, z: 0 }, "INLET"),
      port("outlet", { x: width / 2, y: height * 0.55, z: 0 }, { x: 1, y: 0, z: 0 }, "OUTLET"),
    ];
    return [];
  }
  if (type === "PIPE_CAP") return [port("a", { x: -width / 2, y: 0, z: 0 }, { x: -1, y: 0, z: 0 })];
  if (type === "PIPE_ELBOW_90") return [port("a", { x: -width / 2, y: 0, z: -depth / 2 }, { x: -1, y: 0, z: 0 }), port("b", { x: width / 2, y: 0, z: depth / 2 }, { x: 0, y: 0, z: 1 })];
  if (type === "PIPE_ELBOW_45") return [port("a", { x: -width / 2, y: 0, z: -depth / 2 }, { x: -1, y: 0, z: 0 }), port("b", { x: width / 2, y: 0, z: depth / 2 }, { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 })];
  if (type === "PIPE_T") return [port("a", { x: -width / 2, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }), port("b", { x: width / 2, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), port("branch", { x: 0, y: 0, z: depth / 2 }, { x: 0, y: 0, z: 1 }, "BRANCH")];
  if (type === "PIPE_Y") return [port("a", { x: -width / 2, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }), port("branch-a", { x: width / 2, y: 0, z: depth / 2 }, { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 }, "BRANCH"), port("branch-b", { x: width / 2, y: 0, z: -depth / 2 }, { x: Math.SQRT1_2, y: 0, z: -Math.SQRT1_2 }, "BRANCH")];
  if (type === "PIPE_CROSS") return [port("a", { x: -width / 2, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }), port("b", { x: width / 2, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), port("branch-a", { x: 0, y: 0, z: -depth / 2 }, { x: 0, y: 0, z: -1 }, "BRANCH"), port("branch-b", { x: 0, y: 0, z: depth / 2 }, { x: 0, y: 0, z: 1 }, "BRANCH")];
  return [port("a", { x: -width / 2, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }), port("b", { x: width / 2, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, "MAIN", type === "PIPE_REDUCER" ? Math.max(0.02, finite(parameters.endDiameter, diameter)) : diameter)];
}

export function createCustomEquipmentPart(type = "PIPE_STRAIGHT", overrides = {}) {
  const definition = CUSTOM_EQUIPMENT_PART_MAP[type] ?? CUSTOM_EQUIPMENT_PART_MAP.PIPE_STRAIGHT; const id = overrides.id ?? `part-${crypto.randomUUID()}`;
  const parameters = { ...definition.parameters, ...overrides.parameters };
  const dimensions = getCustomEquipmentPartDimensions(definition.id, parameters, overrides.dimensions ?? definition.dimensions);
  const previous = new Map((overrides.ports ?? []).map((port) => [port.id, port.connectedTo]));
  return {
    id, type: definition.id, templateId: definition.templateId, categoryId: definition.categoryId, partKind: definition.partKind,
    name: overrides.name ?? definition.nameKo, position: vector(overrides.position), rotation: vector(overrides.rotation), dimensions, parameters,
    groupId: overrides.groupId ?? null,
    appearance: { materialPreset: "PAINTED_METAL", color: "#668896", roughness: 0.48, metalness: 0.62, ...(definition.defaultAppearance ?? definition.appearance), ...overrides.appearance },
    ports: portSpecs(definition.id, parameters, dimensions).map((port) => ({ ...port, connectedTo: previous.get(port.id) ?? null })),
  };
}

export function getPartWorldPort(part, portId) {
  const port = part?.ports.find((item) => item.id === portId); if (!port) return null;
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(part.rotation.x, part.rotation.y, part.rotation.z));
  return { ...port, position: new THREE.Vector3(port.localPosition.x, port.localPosition.y, port.localPosition.z).applyQuaternion(quaternion).add(new THREE.Vector3(part.position.x, part.position.y, part.position.z)), direction: new THREE.Vector3(port.direction.x, port.direction.y, port.direction.z).applyQuaternion(quaternion).normalize() };
}

export function recalculateCustomEquipment(source) {
  const parts = (source.parts ?? []).map((part) => createCustomEquipmentPart(part.type, part));
  const partIds = new Set(parts.map((part) => part.id));
  const groups = (source.groups ?? []).map((group) => ({
    ...group,
    partIds: [...new Set((group.partIds ?? []).filter((partId) => partIds.has(partId)))],
  })).filter((group) => group.partIds.length > 1);
  const groupByPart = new Map(groups.flatMap((group) => group.partIds.map((partId) => [partId, group.id])));
  const normalizedParts = parts.map((part) => ({ ...part, groupId: groupByPart.get(part.id) ?? null }));
  const box = new THREE.Box3(); const pairs = new Set();
  normalizedParts.forEach((part) => { const size = getCustomEquipmentPartDimensions(part.type, part.parameters, part.dimensions); const partBox = new THREE.Box3(new THREE.Vector3(-size.width / 2, -size.height / 2, -size.depth / 2), new THREE.Vector3(size.width / 2, size.height / 2, size.depth / 2));
    partBox.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(part.position.x, part.position.y, part.position.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(part.rotation.x, part.rotation.y, part.rotation.z)), new THREE.Vector3(1, 1, 1))); box.union(partBox);
    part.ports.forEach((port) => { if (port.connectedTo) pairs.add([`${part.id}:${port.id}`, `${port.connectedTo.partId}:${port.connectedTo.portId}`].sort().join("|")); }); });
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3()); const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  return { ...source, parts: normalizedParts, groups, origin: source.origin ? vector(source.origin) : vector(center), bounds: { width: size.x, height: size.y, depth: size.z, center: vector(center) }, metrics: { partCount: normalizedParts.length, segmentCount: normalizedParts.filter((part) => part.type === "PIPE_STRAIGHT").length, junctionCount: normalizedParts.filter((part) => ["PIPE_T", "PIPE_Y", "PIPE_CROSS"].includes(part.type)).length, connectionCount: pairs.size, groupCount: groups.length } };
}

export function createDefaultCustomEquipment() {
  const now = new Date().toISOString(); return recalculateCustomEquipment({ id: createCustomAssetId(CUSTOM_ASSET_TYPES.EQUIPMENT), type: CUSTOM_ASSET_TYPES.EQUIPMENT, schemaVersion: CUSTOM_ASSET_SCHEMA_VERSION, revision: 1, name: "새 커스텀 설비", description: "", tags: ["산업설비"], status: CUSTOM_ASSET_STATUS.DRAFT, createdAt: now, updatedAt: now, thumbnail: "", origin: { x: 0, y: 0, z: 0 }, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }, appearance: { materialPreset: "PAINTED_METAL", color: "#668896" }, groups: [], parts: [createCustomEquipmentPart()] });
}

const updatePort = (parts, ref, connectedTo) => parts.map((part) => part.id === ref?.partId ? { ...part, ports: part.ports.map((port) => port.id === ref.portId ? { ...port, connectedTo } : port) } : part);

export function disconnectEquipmentPort(source, partId, portId) {
  const port = source.parts.find((part) => part.id === partId)?.ports.find((item) => item.id === portId); if (!port?.connectedTo) return source;
  return recalculateCustomEquipment({ ...source, parts: updatePort(updatePort(source.parts, { partId, portId }, null), port.connectedTo, null) });
}

export function connectEquipmentPorts(source, sourceRef, targetRef) {
  if (sourceRef.partId === targetRef.partId) return { asset: source, ok: false, reason: "같은 부품의 포트끼리는 연결할 수 없습니다." };
  const first = source.parts.find((part) => part.id === sourceRef.partId)?.ports.find((port) => port.id === sourceRef.portId); const second = source.parts.find((part) => part.id === targetRef.partId)?.ports.find((port) => port.id === targetRef.portId);
  if (!first || !second) return { asset: source, ok: false, reason: "연결 포트를 찾을 수 없습니다." }; if (first.connectedTo || second.connectedTo) return { asset: source, ok: false, reason: "이미 연결된 포트입니다." };
  if (Math.abs(first.diameter - second.diameter) > 0.005) return { asset: source, ok: false, reason: "지름이 달라 레듀서가 필요합니다." };
  return { asset: recalculateCustomEquipment({ ...source, parts: updatePort(updatePort(source.parts, sourceRef, targetRef), targetRef, sourceRef) }), ok: true, reason: "연결됨" };
}

export function alignPartPorts(source, movingRef, targetRef) {
  const moving = source.parts.find((part) => part.id === movingRef.partId); const target = source.parts.find((part) => part.id === targetRef.partId); const movingPort = getPartWorldPort(moving, movingRef.portId); const targetPort = getPartWorldPort(target, targetRef.portId); if (!movingPort || !targetPort) return source;
  const correction = new THREE.Quaternion().setFromUnitVectors(movingPort.direction, targetPort.direction.clone().negate()); const rotation = new THREE.Euler().setFromQuaternion(correction.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(moving.rotation.x, moving.rotation.y, moving.rotation.z))), "XYZ");
  const next = { ...moving, rotation: vector(rotation) }; const aligned = getPartWorldPort(next, movingRef.portId); next.position = { x: next.position.x + targetPort.position.x - aligned.position.x, y: next.position.y + targetPort.position.y - aligned.position.y, z: next.position.z + targetPort.position.z - aligned.position.z };
  return recalculateCustomEquipment({ ...source, parts: source.parts.map((part) => part.id === moving.id ? next : part) });
}

export function findEquipmentSnapCandidate(source, movingPartId, maxDistance = 0.35) {
  const moving = source.parts.find((part) => part.id === movingPartId); let best = null; if (!moving) return best;
  moving.ports.filter((port) => !port.connectedTo).forEach((port) => {
    source.parts.filter((part) => part.id !== movingPartId).forEach((part) => {
      part.ports.filter((candidate) => !candidate.connectedTo).forEach((candidate) => {
        const a = getPartWorldPort(moving, port.id); const b = getPartWorldPort(part, candidate.id);
        const distance = a.position.distanceTo(b.position); const dot = a.direction.dot(b.direction);
        if (distance <= maxDistance && dot < -0.7 && Math.abs(port.diameter - candidate.diameter) <= 0.005 && (!best || distance < best.distance)) best = { movingRef: { partId: moving.id, portId: port.id }, targetRef: { partId: part.id, portId: candidate.id }, distance };
      });
    });
  });
  return best;
}

export function addPartFromPort(source, targetRef, type, directionId = "E") {
  const targetPart = source.parts.find((part) => part.id === targetRef.partId); const targetPort = getPartWorldPort(targetPart, targetRef.portId); if (!targetPort || targetPort.connectedTo) return { asset: source, partId: null, reason: "연장할 수 있는 빈 포트를 선택하세요." };
  const plane = (CUSTOM_EQUIPMENT_DIRECTIONS.find((item) => item.id === directionId) ?? CUSTOM_EQUIPMENT_DIRECTIONS[2]).direction; const direction = new THREE.Vector3(plane.x, 0, plane.z).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(targetPart.rotation.x, targetPart.rotation.y, targetPart.rotation.z)));
  const part = createCustomEquipmentPart(type, { parameters: { diameter: targetPort.diameter }, rotation: { x: 0, y: -Math.atan2(direction.z, direction.x), z: 0 } }); let asset = recalculateCustomEquipment({ ...source, parts: [...source.parts, part] }); asset = alignPartPorts(asset, { partId: part.id, portId: "a" }, targetRef); const result = connectEquipmentPorts(asset, { partId: part.id, portId: "a" }, targetRef); return { asset: result.asset, partId: part.id, reason: result.reason };
}

export function createCustomEquipmentPlacement(source, type, position, {
  directionId = "E",
  preferredPortRef = null,
  snapDistance = 0.35,
} = {}) {
  const direction = (CUSTOM_EQUIPMENT_DIRECTIONS.find((item) => item.id === directionId) ?? CUSTOM_EQUIPMENT_DIRECTIONS[2]).direction;
  const rotation = { x: 0, y: -Math.atan2(direction.z, direction.x), z: 0 };
  const preferredPort = preferredPortRef
    ? source.parts.find((part) => part.id === preferredPortRef.partId)?.ports.find((port) => port.id === preferredPortRef.portId)
    : null;
  const part = createCustomEquipmentPart(type, {
    position,
    rotation,
    parameters: preferredPort && !preferredPort.connectedTo ? { diameter: preferredPort.diameter } : undefined,
  });
  let asset = recalculateCustomEquipment({ ...source, parts: [...source.parts, part] });
  let candidate = findEquipmentSnapCandidate(asset, part.id, snapDistance);

  if (!candidate && preferredPort && !preferredPort.connectedTo) {
    const preferredResult = addPartFromPort(source, preferredPortRef, type, directionId);
    const preferredPart = preferredResult.asset.parts.find((item) => item.id === preferredResult.partId);
    const pointer = new THREE.Vector3(position.x, position.y, position.z);
    const snapRadius = Math.max(0.65, getCustomEquipmentPartDimensions(type, preferredPart?.parameters).width * 0.65);
    if (preferredPart && pointer.distanceTo(new THREE.Vector3(preferredPart.position.x, preferredPart.position.y, preferredPart.position.z)) <= snapRadius) {
      return { ...preferredResult, snapped: true };
    }
  }

  if (!candidate) return { asset, partId: part.id, snapped: false, reason: "원하는 위치를 클릭해 배치하세요." };
  asset = alignPartPorts(asset, candidate.movingRef, candidate.targetRef);
  const connected = connectEquipmentPorts(asset, candidate.movingRef, candidate.targetRef);
  return { asset: connected.asset, partId: part.id, snapped: connected.ok, reason: connected.ok ? "연결 포트에 스냅됩니다." : connected.reason };
}

export function insertJunctionOnStraight(source, partId, junctionType, ratio = 0.5) {
  const part = source.parts.find((item) => item.id === partId); if (!part || part.type !== "PIPE_STRAIGHT") return { asset: source, partId: null, reason: "직선 배관에서만 접합부를 삽입할 수 있습니다." }; if (!["PIPE_T", "PIPE_Y", "PIPE_CROSS"].includes(junctionType)) return { asset: source, partId: null, reason: "지원하지 않는 접합부입니다." };
  const safe = Math.min(0.8, Math.max(0.2, finite(ratio, 0.5))); const length = part.parameters.length; const jointLength = Math.min(length * 0.2, Math.max(0.3, part.parameters.diameter * 1.5)); if (length - jointLength < 0.4) return { asset: source, partId: null, reason: "접합부를 삽입하기에 배관이 너무 짧습니다." };
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(part.rotation.x, part.rotation.y, part.rotation.z)); const start = new THREE.Vector3(part.position.x, part.position.y, part.position.z).add(new THREE.Vector3(-length / 2, 0, 0).applyQuaternion(quaternion)); const at = (distance) => vector(start.clone().add(new THREE.Vector3(distance, 0, 0).applyQuaternion(quaternion)));
  const leftLength = length * safe - jointLength / 2; const rightLength = length * (1 - safe) - jointLength / 2; const left = createCustomEquipmentPart("PIPE_STRAIGHT", { ...part, id: `part-${crypto.randomUUID()}`, name: `${part.name} A`, parameters: { ...part.parameters, length: leftLength }, position: at(leftLength / 2) }); const joint = createCustomEquipmentPart(junctionType, { position: at(length * safe), rotation: part.rotation, parameters: { ...part.parameters, length: jointLength, branchLength: Math.max(0.6, part.parameters.diameter * 3) } }); const right = createCustomEquipmentPart("PIPE_STRAIGHT", { ...part, id: `part-${crypto.randomUUID()}`, name: `${part.name} B`, parameters: { ...part.parameters, length: rightLength }, position: at(length * safe + jointLength / 2 + rightLength / 2) });
  const parts = source.parts.filter((item) => item.id !== partId).map((item) => ({ ...item, ports: item.ports.map((port) => port.connectedTo?.partId !== partId ? port : { ...port, connectedTo: port.connectedTo.portId === "a" ? { partId: left.id, portId: "a" } : { partId: right.id, portId: "b" } }) })); left.ports.find((port) => port.id === "a").connectedTo = part.ports.find((port) => port.id === "a")?.connectedTo ?? null; right.ports.find((port) => port.id === "b").connectedTo = part.ports.find((port) => port.id === "b")?.connectedTo ?? null;
  let asset = recalculateCustomEquipment({ ...source, parts: [...parts, left, joint, right] }); asset = connectEquipmentPorts(asset, { partId: left.id, portId: "b" }, { partId: joint.id, portId: "a" }).asset; asset = connectEquipmentPorts(asset, { partId: joint.id, portId: "b" }, { partId: right.id, portId: "a" }).asset; return { asset, partId: joint.id, reason: "접합부를 삽입했습니다." };
}

export function removeCustomEquipmentParts(source, selectedIds) {
  const removed = new Set(selectedIds);
  return recalculateCustomEquipment({
    ...source,
    parts: source.parts.filter((part) => !removed.has(part.id)).map((part) => ({
      ...part,
      ports: part.ports.map((port) => removed.has(port.connectedTo?.partId) ? { ...port, connectedTo: null } : port),
    })),
    groups: (source.groups ?? []).map((group) => ({ ...group, partIds: group.partIds.filter((partId) => !removed.has(partId)) })),
  });
}

export function removeCustomEquipmentPart(source, partId) {
  return removeCustomEquipmentParts(source, [partId]);
}

export function groupCustomEquipmentParts(source, selectedIds, name = "설비 그룹") {
  const selected = [...new Set(selectedIds)].filter((partId) => source.parts.some((part) => part.id === partId));
  if (selected.length < 2) return { asset: source, groupId: null };
  const cleared = (source.groups ?? []).map((group) => ({ ...group, partIds: group.partIds.filter((partId) => !selected.includes(partId)) }));
  const group = { id: `group-${crypto.randomUUID()}`, name, partIds: selected };
  return { asset: recalculateCustomEquipment({ ...source, groups: [...cleared, group] }), groupId: group.id };
}

export function ungroupCustomEquipmentParts(source, groupId) {
  return recalculateCustomEquipment({ ...source, groups: (source.groups ?? []).filter((group) => group.id !== groupId) });
}

export function alignCustomEquipmentParts(source, selectedIds, axis = "y") {
  const selected = source.parts.filter((part) => selectedIds.includes(part.id));
  if (selected.length < 2 || !["x", "y", "z"].includes(axis)) return source;
  const target = selected.reduce((sum, part) => sum + finite(part.position[axis]), 0) / selected.length;
  return recalculateCustomEquipment({
    ...source,
    parts: source.parts.map((part) => selectedIds.includes(part.id) ? { ...part, position: { ...part.position, [axis]: target } } : part),
  });
}

export function duplicateCustomEquipmentParts(source, selectedIds) {
  const selected = source.parts.filter((part) => selectedIds.includes(part.id));
  if (!selected.length) return { asset: source, partIds: [] };
  const idMap = new Map(selected.map((part) => [part.id, `part-${crypto.randomUUID()}`]));
  const copies = selected.map((part) => createCustomEquipmentPart(part.type, {
    ...part,
    id: idMap.get(part.id),
    groupId: null,
    position: { x: part.position.x + 0.5, y: part.position.y, z: part.position.z + 0.5 },
    ports: part.ports.map((port) => ({
      ...port,
      connectedTo: idMap.has(port.connectedTo?.partId)
        ? { partId: idMap.get(port.connectedTo.partId), portId: port.connectedTo.portId }
        : null,
    })),
  }));
  let asset = recalculateCustomEquipment({ ...source, parts: [...source.parts, ...copies] });
  const copiedIds = copies.map((part) => part.id);
  if (copiedIds.length > 1) asset = groupCustomEquipmentParts(asset, copiedIds, "복제 그룹").asset;
  return { asset, partIds: copiedIds };
}

export function normalizeCustomEquipment(source) { if (!source || source.type !== CUSTOM_ASSET_TYPES.EQUIPMENT) return createDefaultCustomEquipment(); const now = new Date().toISOString(); return recalculateCustomEquipment({ ...source, groups: Array.isArray(source.groups) ? source.groups : [], schemaVersion: CUSTOM_ASSET_SCHEMA_VERSION, revision: Math.max(1, finite(source.revision, 1)), name: String(source.name ?? "이름 없는 커스텀 설비"), description: String(source.description ?? ""), tags: Array.isArray(source.tags) ? source.tags.map(String) : [], status: Object.values(CUSTOM_ASSET_STATUS).includes(source.status) ? source.status : CUSTOM_ASSET_STATUS.DRAFT, createdAt: source.createdAt ?? now, updatedAt: source.updatedAt ?? now, transform: { position: vector(source.transform?.position), rotation: vector(source.transform?.rotation), scale: { x: finite(source.transform?.scale?.x, 1), y: finite(source.transform?.scale?.y, 1), z: finite(source.transform?.scale?.z, 1) } } }); }
