import { releaseSharedGeometry } from "./sharedGeometryCache";

export function disposeObject3D(object) {
  object.traverse((child) => {
    if (child.geometry && !releaseSharedGeometry(child.geometry)) child.geometry.dispose();

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.filter(Boolean).forEach((material) => {
      ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "alphaMap"].forEach((key) => material[key]?.dispose());
      material.dispose();
    });
  });
}
