import * as THREE from "three";
import { EQUIPMENT_SHAPE_TEMPLATE_MAP } from "../constants/equipmentShapeTemplates.js";

const clamp = (value, min, max, fallback) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));
export const ENCLOSURE_WALLS = { front: "앞판", back: "뒷판", left: "왼쪽 벽", right: "오른쪽 벽", top: "천장", bottom: "바닥" };

function doorSet(source, width, height, defaultCount) {
  return {
    doorCount: [0, 1, 2].includes(source.doorCount) ? source.doorCount : defaultCount,
    doorLayout: source.doorLayout === "STACKED" ? "STACKED" : "SIDE_BY_SIDE",
    upperDoorRatio: clamp(source.upperDoorRatio, .001 / height, 1 - .001 / height, .5),
    leftDoorRatio: clamp(source.leftDoorRatio, .001 / width, 1 - .001 / width, .5),
    doors: [0, 1].map((index) => ({
      hinge: ["LEFT", "RIGHT", "TOP", "BOTTOM"].includes(source.doors?.[index]?.hinge) ? source.doors[index].hinge : index === 0 ? "LEFT" : "RIGHT",
      swing: source.doors?.[index]?.swing === "INWARD" ? "INWARD" : "OUTWARD",
      open: source.doors?.[index]?.open === true,
      angle: clamp(source.doors?.[index]?.angle, 0, 180, 150),
      hideWhenOpen: source.doors?.[index]?.hideWhenOpen === true,
    })),
  };
}

export function getEnclosureBodyAppearance(equipment) {
  const body = equipment?.appearanceSlots?.body ?? {};
  const defaults = EQUIPMENT_SHAPE_TEMPLATE_MAP[equipment?.shapeTemplateId]?.materialSlots?.find((slot) => slot.id === "body")?.defaultAppearance ?? {};
  // Older layouts materialized every slot's defaults. An untouched slot must not
  // replace the equipment's saved paint when enabling its cabinet enclosure.
  const customized = Object.entries(body).some(([key, value]) => value !== defaults[key]);
  return { ...equipment?.appearance, ...(customized ? body : {}) };
}

export function getEnclosure(equipment) {
  const source = equipment?.enclosure ?? {};
  const bodyAppearance = getEnclosureBodyAppearance(equipment);
  const defaults = EQUIPMENT_SHAPE_TEMPLATE_MAP[equipment?.shapeTemplateId]?.defaultAppearance;
  // Older equipment templates supplied 86% opacity even for opaque metals.
  // Do not inherit that preview default into an otherwise opaque cabinet.
  // Explicit enclosure/body-slot opacity and customized materials still win.
  const legacyOpacity = bodyAppearance.opacity === .86 && defaults?.opacity === 1
    && equipment?.appearanceSlots?.body?.opacity == null
    && Object.entries(defaults).every(([key, value]) => ["color", "opacity", "showEdges"].includes(key) || bodyAppearance[key] === value);
  const width = clamp(source.width ?? equipment?.dimensions?.width, .05, 100, 1);
  const height = clamp(source.height ?? equipment?.dimensions?.height, .05, 100, 2);
  const depth = clamp(source.depth ?? equipment?.dimensions?.depth, .05, 100, .8);
  const thickness = clamp(source.thickness, .001, Math.min(width, height, depth) / 4, .02);
  return {
    enabled: source.enabled === true, width, height, depth, thickness,
    opacity: clamp(source.opacity ?? (legacyOpacity ? 1 : bodyAppearance.opacity), .05, 1, 1),
    color: /^#[0-9a-f]{6}$/i.test(source.color ?? "") ? source.color : bodyAppearance.color ?? "#78909c",
    walls: Object.fromEntries(Object.keys(ENCLOSURE_WALLS).map((id) => [id, id === "front" ? source.walls?.front === true : source.walls?.[id] !== false])),
    ...doorSet(source, width - 2 * thickness, height - 2 * thickness, 1),
    rear: doorSet(source.rear ?? {}, width - 2 * thickness, height - 2 * thickness, 0),
    interactive: source.interactive !== false,
  };
}

// Overview presentation only: keep the saved door state intact for equipment detail.
export function withClosedEnclosureDoors(equipment) {
  if (!equipment.enclosure?.enabled) return equipment;
  const close = (set) => ({ ...set, doors: set?.doors?.map((door) => ({ ...door, open: false })) });
  return { ...equipment, enclosure: { ...close(equipment.enclosure), rear: close(equipment.enclosure.rear) } };
}

export function getEnclosureDoorLabel(enclosure, index) {
  if (enclosure.doorCount === 1) return "문";
  return enclosure.doorLayout === "STACKED"
    ? index === 0 ? "위쪽 문" : "아래쪽 문"
    : index === 0 ? "왼쪽 문" : "오른쪽 문";
}

export function getEnclosureDoor(equipment, index, side = "FRONT") {
  const c = getEnclosure(equipment), set = side === "REAR" ? c.rear : c, door = set.doors[index];
  const stacked = set.doorCount === 2 && set.doorLayout === "STACKED";
  const innerHeight = c.height - 2 * c.thickness;
  const upperHeight = innerHeight * set.upperDoorRatio;
  const innerWidth = c.width - c.thickness * 2;
  const splitWidth = !stacked && set.doorCount === 2;
  const leftWidth = innerWidth * set.leftDoorRatio;
  const width = splitWidth ? index === 0 ? leftWidth : innerWidth - leftWidth : innerWidth;
  const height = stacked ? index === 0 ? upperHeight : innerHeight - upperHeight : innerHeight;
  const left = -c.width / 2 + c.thickness + (splitWidth && index === 1 ? leftWidth : 0);
  const bottom = c.thickness + (stacked && index === 0 ? innerHeight - upperHeight : 0);
  const hingeX = door.hinge === "RIGHT" ? left + width : left;
  const hingeY = door.hinge === "TOP" ? bottom + height : bottom;
  const horizontalHinge = door.hinge === "TOP" || door.hinge === "BOTTOM";
  const angle = (door.open ? door.angle * Math.PI / 180 : 0) * (["LEFT", "TOP"].includes(door.hinge) ? -1 : 1) * (door.swing === "INWARD" ? -1 : 1);
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(horizontalHinge ? 1 : 0, horizontalHinge ? 0 : 1, 0), angle);
  const origin = new THREE.Vector3(hingeX, hingeY, c.depth / 2 - c.thickness / 2);
  if (side === "REAR") {
    const rearRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    origin.applyQuaternion(rearRotation); rotation.premultiply(rearRotation);
  }
  return { ...door, width, height, origin, rotation, leftOffset: left - hingeX, bottomOffset: bottom - hingeY, thickness: c.thickness };
}

export function getEnclosureDoorEntries(equipment) {
  const c = getEnclosure(equipment);
  return ["FRONT", "REAR"].flatMap((side) => {
    const set = side === "REAR" ? c.rear : c;
    return set.doors.slice(0, set.doorCount).map((door, index) => ({ ...door, index, side,
      id: `${side === "REAR" ? "rear-door" : "door"}-${index}`,
      label: `${side === "REAR" ? "뒤" : "앞"} · ${getEnclosureDoorLabel(set, index)}`,
    }));
  });
}

// Surface axes are metres from the face's lower-left corner, viewed head-on.
// A hidden door keeps its physical transform so its sensors never detach.
export function getEnclosureSurfaces(equipment) {
  const c = getEnclosure(equipment);
  if (!c.enabled) return [];
  const { width: w, height: h, depth: d, thickness: t } = c;
  const surfaces = [];
  const add = (id, label, origin, right, up, normal, width, height, visible = true) => surfaces.push({ id, label, origin: new THREE.Vector3(...origin), right: new THREE.Vector3(...right), up: new THREE.Vector3(...up), normal: new THREE.Vector3(...normal), width, height, visible });
  if (c.walls.back && !c.rear.doorCount) add("back", "뒷벽 안쪽", [-w / 2 + t, t, -d / 2 + t], [1, 0, 0], [0, 1, 0], [0, 0, 1], w - 2 * t, h - 2 * t);
  if (c.walls.front && !c.doorCount) add("front", "앞판 안쪽", [w / 2 - t, t, d / 2 - t], [-1, 0, 0], [0, 1, 0], [0, 0, -1], w - 2 * t, h - 2 * t);
  if (c.walls.left) add("left", "왼쪽 내벽", [-w / 2 + t, t, d / 2 - t], [0, 0, -1], [0, 1, 0], [1, 0, 0], d - 2 * t, h - 2 * t);
  if (c.walls.right) add("right", "오른쪽 내벽", [w / 2 - t, t, -d / 2 + t], [0, 0, 1], [0, 1, 0], [-1, 0, 0], d - 2 * t, h - 2 * t);
  if (c.walls.top) add("top", "천장 안쪽", [-w / 2 + t, h - t, -d / 2 + t], [1, 0, 0], [0, 0, 1], [0, -1, 0], w - 2 * t, d - 2 * t);
  if (c.walls.bottom) add("bottom", "바닥 안쪽", [-w / 2 + t, t, d / 2 - t], [1, 0, 0], [0, 0, -1], [0, 1, 0], w - 2 * t, d - 2 * t);
  for (const surface of [...surfaces]) {
    const origin = surface.origin.clone().addScaledVector(surface.right, surface.width).addScaledVector(surface.normal, -t);
    add(`${surface.id}-outside`, surface.label.replace(/안쪽|내벽/, "바깥쪽"), origin.toArray(), surface.right.clone().negate().toArray(), surface.up.toArray(), surface.normal.clone().negate().toArray(), surface.width, surface.height);
  }
  for (const { index, side, id, label } of getEnclosureDoorEntries(equipment)) {
    const door = getEnclosureDoor(equipment, index, side);
    for (const inside of [true, false]) {
      const origin = new THREE.Vector3(door.leftOffset + (inside ? door.width : 0), door.bottomOffset, inside ? -t / 2 : t / 2).applyQuaternion(door.rotation).add(door.origin);
      const right = new THREE.Vector3(inside ? -1 : 1, 0, 0).applyQuaternion(door.rotation);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(door.rotation);
      const normal = new THREE.Vector3(0, 0, inside ? -1 : 1).applyQuaternion(door.rotation);
      add(`${id}-${inside ? "inside" : "outside"}`, `${label} ${inside ? "안쪽" : "바깥쪽"}`, origin.toArray(), right.toArray(), up.toArray(), normal.toArray(), door.width, door.height, !(door.open && door.hideWhenOpen));
    }
  }
  return surfaces;
}

export function getSensorMountPose(sensor, equipment) {
  const mount = sensor?.surfaceMount;
  const surface = mount?.equipmentId === equipment?.id ? getEnclosureSurfaces(equipment).find((item) => item.id === mount.surfaceId) : null;
  if (!surface) return null;
  const u = clamp(mount.u, 0, surface.width, surface.width / 2);
  const v = clamp(mount.v, 0, surface.height, surface.height / 2);
  const offset = clamp(mount.offset, 0, 2, .025);
  const position = surface.origin.clone().addScaledVector(surface.right, u).addScaledVector(surface.up, v).addScaledVector(surface.normal, offset);
  // Sensor forward = -Y, sensor image up = -Z.
  const frame = new THREE.Matrix4().makeBasis(surface.right.clone().negate(), surface.normal.clone().negate(), surface.up.clone().negate());
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(frame).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(sensor.rotation?.x ?? 0, sensor.rotation?.y ?? 0, sensor.rotation?.z ?? 0)));
  const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  return { position, rotation, surface, adjusted: u !== Number(mount.u) || v !== Number(mount.v) };
}

export function projectSensorMount(surface, point, offset = .025) {
  const delta = point.clone().sub(surface.origin);
  return { u: clamp(delta.dot(surface.right), 0, surface.width, 0), v: clamp(delta.dot(surface.up), 0, surface.height, 0), offset };
}

export function withDoorOverrides(equipment, override) {
  if (!override || override.key !== JSON.stringify(equipment.enclosure)) return equipment;
  const enclosure = getEnclosure(equipment);
  return { ...equipment, enclosure: { ...enclosure,
    doors: enclosure.doors.map((door, index) => ({ ...door, open: override.open?.[index] ?? door.open })),
    rear: { ...enclosure.rear, doors: enclosure.rear.doors.map((door, index) => ({ ...door, open: override.rearOpen?.[index] ?? door.open })) },
  } };
}

export function enclosureDoorOverride(original, displayed, index, open, side = "FRONT") {
  const c = getEnclosure(displayed);
  return { key: JSON.stringify(original.enclosure),
    open: c.doors.map((door, i) => side === "FRONT" && i === index ? open : door.open),
    rearOpen: c.rear.doors.map((door, i) => side === "REAR" && i === index ? open : door.open),
  };
}

export function advanceEnclosureDoors(current, target, delta, reducedMotion = false) {
  if (reducedMotion || current === target) return target;
  const previous = getEnclosure(current), next = getEnclosure(target);
  let moving = false;
  function advance(from, to) {
    return to.map((door, index) => {
      const start = from[index].open ? from[index].angle : 0, end = door.open ? door.angle : 0;
      if (Math.abs(end - start) < .05) return door;
      moving = true;
      return { ...door, open: true, hideWhenOpen: false, angle: start + (end - start) * (1 - Math.exp(-18 * Math.min(.1, delta))) };
    });
  }
  const doors = advance(previous.doors, next.doors), rearDoors = advance(previous.rear.doors, next.rear.doors);
  return moving ? { ...target, enclosure: { ...next, doors, rear: { ...next.rear, doors: rearDoors } } } : target;
}
