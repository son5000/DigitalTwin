import { cloneMaterialForMutation } from "./presetMaterial";

export function makePlacementPreviewTransparent(root, opacity = 0.42) {
  root.traverse((child) => {
    if (!child.material) return;
    child.material = Array.isArray(child.material)
      ? child.material.map(cloneMaterialForMutation)
      : cloneMaterialForMutation(child.material);
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = child.isLine ? Math.min(0.8, opacity + 0.3) : opacity;
      material.depthWrite = false;
      if (material.emissive) material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.18);
      material.needsUpdate = true;
    });
  });
  root.userData.placementPreview = true;
  return root;
}
