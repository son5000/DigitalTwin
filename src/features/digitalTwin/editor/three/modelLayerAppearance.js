import { cloneMaterialForMutation } from "./presetMaterial.js";

const bases = new WeakMap();

// Visibility belongs to the model root. Never reveal its hidden doors or parts.
export function applyModelLayerAppearance(root, settings, defaultVisible = true) {
  if (!root) return;
  root.visible = settings?.visible ?? defaultVisible;
  root.userData.modelLayerOpacity = Number.isFinite(settings?.opacity) ? Math.max(0, Math.min(1, settings.opacity)) : null;
  root.traverse((object) => {
    if (object.userData.monitoringOverlay || !object.material) return;
    // Preset materials are shared across equipment and previews. Each mesh keeps
    // its existing cache reference through the borrowed clone until disposal.
    if (Array.isArray(object.material)) {
      if (object.material.some((material) => material.userData.sharedMaterialKey)) {
        object.material = object.material.map(cloneMaterialForMutation);
      }
    } else {
      object.material = cloneMaterialForMutation(object.material);
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!bases.has(material)) bases.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
      const base = bases.get(material);
      const opacity = Number.isFinite(settings?.opacity) ? Math.max(0, Math.min(1, settings.opacity)) : base.opacity;
      const transparent = base.transparent || opacity < 1;
      if (material.transparent !== transparent) material.needsUpdate = true;
      material.opacity = opacity; material.transparent = transparent;
      material.depthWrite = base.depthWrite && opacity >= .99;
    }
  });
}
