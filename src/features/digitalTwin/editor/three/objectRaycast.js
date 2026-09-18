// Decorative edges have a world-space hit tolerance and must not intercept
// clicks meant for a nearby surface. Also ignore surfaces the renderer hides.
export function isVisibleSurfaceIntersection(intersection, root) {
  const object = intersection.object;
  if (!object.isMesh && !object.isPoints) return false;
  for (let current = object; current; current = current.parent) {
    if (!current.visible) return false;
    if (current === root) break;
  }
  const materials = Array.isArray(object.material)
    ? intersection.face ? [object.material[intersection.face.materialIndex]] : object.material
    : [object.material];
  return materials.some((material) => material && material.visible !== false
    && (!material.transparent || material.opacity > 0.001));
}
