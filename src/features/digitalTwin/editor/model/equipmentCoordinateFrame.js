import { Euler, Quaternion, Vector3 } from "three";

const vector = (value) => Array.isArray(value) ? new Vector3(...value) : new Vector3(value?.x ?? 0, value?.y ?? 0, value?.z ?? 0);
const plain = (value) => ({ x: value.x, y: value.y, z: value.z });
const orientation = (frame) => new Quaternion().setFromEuler(new Euler(...(frame?.rotation ?? [0, 0, 0]), "XYZ"));

export function getEquipmentCoordinateFrame(equipment) {
  return equipment?.metadata?.coordinateFrame ?? null;
}

export function validateCoordinateFrame(frame, equipmentId) {
  if (!frame || frame.equipmentId !== equipmentId || !frame.id || !Number.isInteger(frame.version) || frame.version < 1
    || frame.unit !== "m" || frame.handedness !== "RIGHT" || frame.up !== "+Y" || frame.front !== "+Z"
    || [frame.origin, frame.rotation].some((v) => !Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite))
    || frame.rotation[0] !== 0 || frame.rotation[2] !== 0) throw new Error("설비 기준좌표의 원점·정면·버전을 확인하세요.");
  return frame;
}

// Geometry stays in model-local coordinates. This rigid transform is shared by
// sensor/ROI controls and API boundaries; changing the datum never moves objects.
export function modelToReference(position, frame) {
  return plain(vector(position).sub(vector(frame?.origin)).applyQuaternion(orientation(frame).invert()));
}

export function referenceToModel(position, frame) {
  return plain(vector(position).applyQuaternion(orientation(frame)).add(vector(frame?.origin)));
}

export function modelRotationToReference(rotation, frame) {
  const q = new Quaternion().setFromEuler(new Euler(rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0, "XYZ"));
  const euler = new Euler().setFromQuaternion(orientation(frame).invert().multiply(q), "XYZ");
  return plain(euler);
}

export function equipmentBounds(equipment) {
  const { width = 1, height = 1, depth = 1 } = { ...equipment?.dimensions, ...(equipment?.enclosure?.enabled ? Object.fromEntries(Object.entries(equipment.enclosure).filter(([key]) => ["width", "height", "depth"].includes(key))) : {}) };
  return { min: [-width / 2, 0, -depth / 2], max: [width / 2, height, depth / 2] };
}

export function frontLowerLeft(bounds, yaw = 0) {
  const rotation = { rotation: [0, yaw, 0] };
  const corners = [];
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) corners.push(modelToReference({ x, y, z }, rotation));
  return referenceToModel({ x: Math.min(...corners.map((p) => p.x)), y: Math.min(...corners.map((p) => p.y)), z: Math.max(...corners.map((p) => p.z)) }, rotation);
}

export function createEquipmentCoordinateFrame(equipment, origin, yaw, originMode = "CUSTOM") {
  const previous = getEquipmentCoordinateFrame(equipment);
  const next = validateCoordinateFrame({ id: previous?.id ?? `equipment-frame:${equipment.id}`, equipmentId: equipment.id,
    version: (previous?.version ?? 0) + 1, unit: "m", handedness: "RIGHT", up: "+Y", front: "+Z",
    origin: vector(origin).toArray(), rotation: [0, yaw, 0], originMode }, equipment.id);
  return previous && JSON.stringify([previous.origin, previous.rotation, previous.originMode]) === JSON.stringify([next.origin, next.rotation, next.originMode]) ? previous : next;
}

export function referenceFrameKey(frame) { return frame ? `${frame.id}:${frame.version}` : "MODEL_LOCAL"; }

export function sensorReferencePose(sensor, equipment, mounted) {
  const frame = getEquipmentCoordinateFrame(equipment);
  let position = vector(mounted?.position ?? sensor.position);
  let rotation = new Quaternion().setFromEuler(new Euler(...["x", "y", "z"].map((axis) => (mounted?.rotation ?? sensor.rotation)?.[axis] ?? 0), "XYZ"));
  if (!mounted && sensor.mountMode !== "EQUIPMENT" && frame) {
    const host = new Quaternion().setFromEuler(new Euler(equipment.rotation?.x ?? 0, equipment.rotation?.y ?? 0, equipment.rotation?.z ?? 0, "XYZ"));
    position.sub(vector(equipment.position)).applyQuaternion(host.clone().invert());
    rotation.premultiply(host.invert());
  }
  return { position: modelToReference(position, frame), rotation: modelRotationToReference(new Euler().setFromQuaternion(rotation, "XYZ"), frame) };
}

export function mapSurfaceCoordinates(surface, frame, toReference = true) {
  const convert = (point) => Object.values((toReference ? modelToReference : referenceToModel)(point, frame));
  return { ...surface, ...(surface.center ? { center: convert(surface.center) } : {}),
    ...(surface.vertices ? { vertices: surface.vertices.map(convert) } : {}) };
}

export function resultPositionToModel(record, equipment) {
  const frame = getEquipmentCoordinateFrame(equipment);
  if (!Array.isArray(record.position) || record.position.length !== 3 || !record.position.every(Number.isFinite)) throw new Error("수신 좌표를 확인하세요.");
  if (!record.coordinateFrame) {
    if (frame) throw new Error("수신 좌표에 설비 기준좌표 정보가 없습니다.");
    return record.position;
  }
  if (!frame || record.coordinateFrame.id !== frame.id || record.coordinateFrame.version !== frame.version || record.equipmentId !== equipment.id) throw new Error("수신 좌표의 설비 기준 버전이 다릅니다. 보정값을 다시 전송하세요.");
  return Object.values(referenceToModel(record.position, frame));
}
