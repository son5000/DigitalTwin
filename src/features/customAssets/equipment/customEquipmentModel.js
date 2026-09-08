import * as THREE from "three";

import { CUSTOM_ASSET_SCHEMA_VERSION, CUSTOM_ASSET_STATUS, CUSTOM_ASSET_TYPES, createCustomAssetId } from "../core/customAssetTypes.js";

export const CUSTOM_EQUIPMENT_PART_LIBRARY = Object.freeze([
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
  parameters,
  thumbnailSource: `/assets/object-thumbnails/${id}.png`,
})));

export const CUSTOM_EQUIPMENT_PART_MAP = Object.freeze(Object.fromEntries(CUSTOM_EQUIPMENT_PART_LIBRARY.map((item) => [item.id, item])));
export const CUSTOM_EQUIPMENT_DIRECTIONS = Object.freeze([
  ["N", "위", 0, -1], ["NE", "오른쪽 위", 1, -1], ["E", "오른쪽", 1, 0], ["SE", "오른쪽 아래", 1, 1],
  ["S", "아래", 0, 1], ["SW", "왼쪽 아래", -1, 1], ["W", "왼쪽", -1, 0], ["NW", "왼쪽 위", -1, -1],
].map(([id, label, x, z]) => ({ id, label, direction: { x: x / Math.hypot(x, z), y: 0, z: z / Math.hypot(x, z) } })));

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const vector = (value = {}, fallback = {}) => ({ x: finite(value.x, fallback.x), y: finite(value.y, fallback.y), z: finite(value.z, fallback.z) });

export function getCustomEquipmentPartDimensions(type, parameters = {}) {
  const length = Math.max(0.1, finite(parameters.length, 1)); const diameter = Math.max(0.02, finite(parameters.diameter, 0.2));
  const radius = Math.max(diameter, finite(parameters.bendRadius, length / 2)); const branch = Math.max(diameter, finite(parameters.branchLength, length / 2));
  if (type === "PIPE_ELBOW_90") return { width: radius + diameter, height: diameter, depth: radius + diameter };
  if (type === "PIPE_ELBOW_45") return { width: radius * 1.7 + diameter, height: diameter, depth: radius * 0.75 + diameter };
  if (["PIPE_T", "PIPE_Y", "PIPE_CROSS"].includes(type)) return { width: length, height: diameter, depth: branch };
  return { width: length, height: type === "PIPE_VALVE" ? diameter * 4.5 : diameter, depth: diameter };
}

function portSpecs(type, parameters) {
  const { width, depth } = getCustomEquipmentPartDimensions(type, parameters); const diameter = Math.max(0.02, finite(parameters.diameter, 0.2));
  const port = (id, x, z, dx, dz, role = "MAIN", size = diameter) => ({ id, localPosition: { x, y: 0, z }, direction: { x: dx, y: 0, z: dz }, diameter: size, role, connectedTo: null, connectable: true });
  if (type === "PIPE_CAP") return [port("a", -width / 2, 0, -1, 0)];
  if (type === "PIPE_ELBOW_90") return [port("a", -width / 2, -depth / 2, -1, 0), port("b", width / 2, depth / 2, 0, 1)];
  if (type === "PIPE_ELBOW_45") return [port("a", -width / 2, -depth / 2, -1, 0), port("b", width / 2, depth / 2, Math.SQRT1_2, Math.SQRT1_2)];
  if (type === "PIPE_T") return [port("a", -width / 2, 0, -1, 0), port("b", width / 2, 0, 1, 0), port("branch", 0, depth / 2, 0, 1, "BRANCH")];
  if (type === "PIPE_Y") return [port("a", -width / 2, 0, -1, 0), port("branch-a", width / 2, depth / 2, Math.SQRT1_2, Math.SQRT1_2, "BRANCH"), port("branch-b", width / 2, -depth / 2, Math.SQRT1_2, -Math.SQRT1_2, "BRANCH")];
  if (type === "PIPE_CROSS") return [port("a", -width / 2, 0, -1, 0), port("b", width / 2, 0, 1, 0), port("branch-a", 0, -depth / 2, 0, -1, "BRANCH"), port("branch-b", 0, depth / 2, 0, 1, "BRANCH")];
  return [port("a", -width / 2, 0, -1, 0), port("b", width / 2, 0, 1, 0, "MAIN", type === "PIPE_REDUCER" ? Math.max(0.02, finite(parameters.endDiameter, diameter)) : diameter)];
}

export function createCustomEquipmentPart(type = "PIPE_STRAIGHT", overrides = {}) {
  const definition = CUSTOM_EQUIPMENT_PART_MAP[type] ?? CUSTOM_EQUIPMENT_PART_MAP.PIPE_STRAIGHT; const id = overrides.id ?? `part-${crypto.randomUUID()}`;
  const parameters = { ...definition.parameters, ...overrides.parameters }; const previous = new Map((overrides.ports ?? []).map((port) => [port.id, port.connectedTo]));
  return { id, type: definition.id, templateId: definition.templateId, name: overrides.name ?? definition.nameKo, position: vector(overrides.position), rotation: vector(overrides.rotation), parameters,
    appearance: { materialPreset: "PAINTED_METAL", color: "#668896", roughness: 0.48, metalness: 0.62, ...overrides.appearance }, ports: portSpecs(definition.id, parameters).map((port) => ({ ...port, connectedTo: previous.get(port.id) ?? null })) };
}

export function getPartWorldPort(part, portId) {
  const port = part?.ports.find((item) => item.id === portId); if (!port) return null;
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(part.rotation.x, part.rotation.y, part.rotation.z));
  return { ...port, position: new THREE.Vector3(port.localPosition.x, port.localPosition.y, port.localPosition.z).applyQuaternion(quaternion).add(new THREE.Vector3(part.position.x, part.position.y, part.position.z)), direction: new THREE.Vector3(port.direction.x, port.direction.y, port.direction.z).applyQuaternion(quaternion).normalize() };
}

export function recalculateCustomEquipment(source) {
  const parts = (source.parts ?? []).map((part) => createCustomEquipmentPart(part.type, part)); const box = new THREE.Box3(); const pairs = new Set();
  parts.forEach((part) => { const size = getCustomEquipmentPartDimensions(part.type, part.parameters); const partBox = new THREE.Box3(new THREE.Vector3(-size.width / 2, -size.height / 2, -size.depth / 2), new THREE.Vector3(size.width / 2, size.height / 2, size.depth / 2));
    partBox.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(part.position.x, part.position.y, part.position.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(part.rotation.x, part.rotation.y, part.rotation.z)), new THREE.Vector3(1, 1, 1))); box.union(partBox);
    part.ports.forEach((port) => { if (port.connectedTo) pairs.add([`${part.id}:${port.id}`, `${port.connectedTo.partId}:${port.connectedTo.portId}`].sort().join("|")); }); });
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3()); const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  return { ...source, parts, origin: source.origin ? vector(source.origin) : vector(center), bounds: { width: size.x, height: size.y, depth: size.z, center: vector(center) }, metrics: { partCount: parts.length, segmentCount: parts.filter((part) => part.type === "PIPE_STRAIGHT").length, junctionCount: parts.filter((part) => ["PIPE_T", "PIPE_Y", "PIPE_CROSS"].includes(part.type)).length, connectionCount: pairs.size } };
}

export function createDefaultCustomEquipment() {
  const now = new Date().toISOString(); return recalculateCustomEquipment({ id: createCustomAssetId(CUSTOM_ASSET_TYPES.EQUIPMENT), type: CUSTOM_ASSET_TYPES.EQUIPMENT, schemaVersion: CUSTOM_ASSET_SCHEMA_VERSION, revision: 1, name: "새 커스텀 설비", description: "", tags: ["배관"], status: CUSTOM_ASSET_STATUS.DRAFT, createdAt: now, updatedAt: now, thumbnail: "", origin: { x: 0, y: 0, z: 0 }, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }, appearance: { materialPreset: "PAINTED_METAL", color: "#668896" }, parts: [createCustomEquipmentPart()] });
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

export function removeCustomEquipmentPart(source, partId) { return recalculateCustomEquipment({ ...source, parts: source.parts.filter((part) => part.id !== partId).map((part) => ({ ...part, ports: part.ports.map((port) => port.connectedTo?.partId === partId ? { ...port, connectedTo: null } : port) })) }); }
export function normalizeCustomEquipment(source) { if (!source || source.type !== CUSTOM_ASSET_TYPES.EQUIPMENT) return createDefaultCustomEquipment(); const now = new Date().toISOString(); return recalculateCustomEquipment({ ...source, schemaVersion: CUSTOM_ASSET_SCHEMA_VERSION, revision: Math.max(1, finite(source.revision, 1)), name: String(source.name ?? "이름 없는 커스텀 설비"), description: String(source.description ?? ""), tags: Array.isArray(source.tags) ? source.tags.map(String) : [], status: Object.values(CUSTOM_ASSET_STATUS).includes(source.status) ? source.status : CUSTOM_ASSET_STATUS.DRAFT, createdAt: source.createdAt ?? now, updatedAt: source.updatedAt ?? now, transform: { position: vector(source.transform?.position), rotation: vector(source.transform?.rotation), scale: { x: finite(source.transform?.scale?.x, 1), y: finite(source.transform?.scale?.y, 1), z: finite(source.transform?.scale?.z, 1) } } }); }
