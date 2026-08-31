import { releaseSharedGeometry } from "./sharedGeometryCache";
import { releaseBorrowedSharedMaterial, releaseSharedMaterial } from "./presetMaterial";

export function disposeObject3D(object) {
  object.userData.disposed = true;
  object.userData.releaseUserTexture?.();
  delete object.userData.releaseUserTexture;
  object.traverse((child) => {
    if (child.geometry && !releaseSharedGeometry(child.geometry)) child.geometry.dispose();

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.filter(Boolean).forEach((material) => {
      if (releaseSharedMaterial(material)) return;
      if (releaseBorrowedSharedMaterial(material)) {
        material.dispose();
        return;
      }
      if (!material.userData?.borrowedTextures) {
        ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "alphaMap"].forEach((key) => material[key]?.dispose());
      }
      material.dispose();
    });
  });
}
