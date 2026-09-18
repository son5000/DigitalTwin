export function getEquipmentIdFromIntersection(intersection, root = null) {
  const instanceIds = intersection?.object?.userData?.equipmentInstanceIds;
  if (Number.isInteger(intersection?.instanceId) && instanceIds?.[intersection.instanceId]) {
    return instanceIds[intersection.instanceId];
  }
  for (let object = intersection?.object; object && object !== root; object = object.parent) {
    if (object.userData?.equipmentId) return object.userData.equipmentId;
  }
  return null;
}

export function pickEquipmentId(raycaster, root) {
  if (!root?.visible) return null;
  for (const intersection of raycaster.intersectObject(root, true)) {
    const visible = (() => {
      const { object } = intersection;
      for (let current = object; current; current = current.parent) {
        if (!current.visible) return false;
        if (current === root) return true;
      }
      return false;
    })();
    if (!visible) continue;
    const equipmentId = getEquipmentIdFromIntersection(intersection, root);
    if (equipmentId) return equipmentId;
  }
  return null;
}
