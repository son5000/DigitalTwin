import * as THREE from "three";
import { getEnclosure, getEnclosureBodyAppearance, getEnclosureDoor, getEnclosureDoorEntries, getEnclosureScanSlot } from "../model/equipmentEnclosure.js";
import { addEquipmentLabel, addGeometry } from "./generatorHelpers";

export function generateEnclosure(equipment, { edgeColor, sceneTheme }) {
  const c = getEnclosure(equipment), { width: w, height: h, depth: d, thickness: t } = c;
  const group = new THREE.Group();
  const appearance = { ...getEnclosureBodyAppearance(equipment), color: c.color, opacity: c.opacity };
  function panel(parent, id, dimensions, position) {
    const mesh = addGeometry(parent, new THREE.BoxGeometry(...dimensions), { appearance, materialSlot: "body", edgeColor, position, showEdges: appearance.showEdges !== false });
    mesh.userData.enclosurePanel = id;
    return mesh;
  }
  if (c.walls.back && !c.rear.doorCount) panel(group, "back", [w, h, t], [0, h / 2, -d / 2 + t / 2]);
  if (c.walls.front && !c.doorCount) panel(group, "front", [w, h, t], [0, h / 2, d / 2 - t / 2]);
  if (c.walls.left) panel(group, "left", [t, h, d - t], [-w / 2 + t / 2, h / 2, t / 2]);
  if (c.walls.right) panel(group, "right", [t, h, d - t], [w / 2 - t / 2, h / 2, t / 2]);
  if (c.walls.top) panel(group, "top", [w - 2 * t, t, d - t], [0, h - t / 2, t / 2]);
  if (c.walls.bottom) panel(group, "bottom", [w - 2 * t, t, d - t], [0, t / 2, t / 2]);
  if (c.bodyLayout === "BACK_TO_BACK") {
    const rear = getEnclosureScanSlot(equipment, 0, "REAR");
    const rearDepth = rear?.dimensions.depth ?? (d - 3 * t) * (1 - c.frontDepthRatio);
    panel(group, "center-divider", [w - 2 * t, h - 2 * t, t], [0, h / 2, -d / 2 + t + rearDepth + t / 2]);
  }
  for (const side of ["FRONT", "REAR"]) {
    const set = side === "FRONT" ? c : c.rear;
    for (let index = 0; index < set.doorCount - 1; index++) {
      const slot = getEnclosureScanSlot(equipment, index, side);
      if (!slot) continue;
      if (set.doorLayout === "STACKED") {
        const boundary = set.stackOrder === "BOTTOM_UP" ? slot.cell.bottom + slot.cell.height : slot.cell.bottom;
        panel(group, `${side.toLowerCase()}-shelf-${index}`, [w - 2 * t, t, slot.dimensions.depth],
          [0, boundary, slot.centerZ]);
      } else {
        const boundary = side === "FRONT" ? slot.cell.left + slot.cell.width : -(slot.cell.left + slot.cell.width);
        panel(group, `${side.toLowerCase()}-divider-${index}`, [t, h - 2 * t, slot.dimensions.depth],
          [boundary, h / 2, slot.centerZ]);
      }
    }
  }
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
