import * as THREE from "three";
import { getEnclosure, getEnclosureDoor, getEnclosureDoorEntries } from "../model/equipmentEnclosure.js";
import { addEquipmentLabel, addGeometry } from "./generatorHelpers";

export function generateEnclosure(equipment, { edgeColor, sceneTheme }) {
  const c = getEnclosure(equipment), { width: w, height: h, depth: d, thickness: t } = c;
  const group = new THREE.Group();
  const appearance = { ...equipment.appearance, color: c.color, opacity: c.opacity };
  function panel(parent, id, dimensions, position) {
    const mesh = addGeometry(parent, new THREE.BoxGeometry(...dimensions), { appearance, edgeColor, position, showEdges: true });
    mesh.userData.enclosurePanel = id;
    return mesh;
  }
  if (c.walls.back && !c.rear.doorCount) panel(group, "back", [w, h, t], [0, h / 2, -d / 2 + t / 2]);
  if (c.walls.front && !c.doorCount) panel(group, "front", [w, h, t], [0, h / 2, d / 2 - t / 2]);
  if (c.walls.left) panel(group, "left", [t, h, d - t], [-w / 2 + t / 2, h / 2, t / 2]);
  if (c.walls.right) panel(group, "right", [t, h, d - t], [w / 2 - t / 2, h / 2, t / 2]);
  if (c.walls.top) panel(group, "top", [w - 2 * t, t, d - t], [0, h - t / 2, t / 2]);
  if (c.walls.bottom) panel(group, "bottom", [w - 2 * t, t, d - t], [0, t / 2, t / 2]);
  for (const { index, side, id } of getEnclosureDoorEntries(equipment)) {
    const door = getEnclosureDoor(equipment, index, side);
    const pivot = new THREE.Group();
    pivot.userData.enclosureDoorIndex = index;
    pivot.userData.enclosureDoorSide = side;
    pivot.position.copy(door.origin); pivot.quaternion.copy(door.rotation);
    pivot.visible = !(door.open && door.hideWhenOpen);
    panel(pivot, id, [door.width, door.height, t], [door.leftOffset + door.width / 2, door.bottomOffset + door.height / 2, 0]);
    group.add(pivot);
  }
  addEquipmentLabel(group, equipment.showNameLabel ? equipment.name : null, h, edgeColor, sceneTheme);
  return group;
}

export function updateEnclosureDoors(object, equipment) {
  object.traverse((child) => {
    const index = child.userData.enclosureDoorIndex;
    if (index === undefined) return;
    const door = getEnclosureDoor(equipment, index, child.userData.enclosureDoorSide);
    child.position.copy(door.origin); child.quaternion.copy(door.rotation);
    child.visible = !(door.open && door.hideWhenOpen);
  });
  object.updateMatrixWorld(true);
}
