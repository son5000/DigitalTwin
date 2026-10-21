import * as THREE from "three";
import { getGroundViewPresentation } from "../model/undergroundModel.js";
import { normalizeEquipmentEnvironment } from "../model/viewerPreset.js";

// Update only scene decoration; preserve model geometry, controls and camera pose.
export function applyEquipmentEnvironment({ scene, renderer, ground, grid }, source, fallbackMode, theme) {
  const base = ground.userData.environmentBase ??= { size: ground.geometry.parameters.width, y: ground.position.y, gridY: grid.position.y, divisions: grid.geometry.attributes.position.count / 4 - 1, renderOrder: ground.renderOrder };
  const config = source ? normalizeEquipmentEnvironment(source) : null;
  const presentation = getGroundViewPresentation(config?.groundMode ?? fallbackMode, config?.groundOpacity);
  scene.background.set(config?.backgroundColor ?? (theme === "light" ? "#e8eef1" : "#0b1217"));
  ground.material.color.set(config?.groundColor ?? (theme === "light" ? "#cbd5da" : "#17242b"));
  const size = config?.groundSize ?? base.size;
  ground.scale.set(size / base.size, size / base.size, 1);
  ground.position.y = config ? config.groundHeight - 0.015 : base.y;
  grid.position.y = config ? config.groundHeight : base.gridY;
  // Bound line count for very large grounds without changing the requested spacing.
  const spacing = config?.gridSpacing ?? size / base.divisions;
  const divisions = Math.max(1, Math.min(500, Math.floor(size / spacing)));
  const gridSize = config ? divisions * spacing : size;
  const gridColor = config?.gridColor ?? (theme === "light" ? "#6f8792" : "#456577");
  const gridKey = `${gridSize}:${divisions}:${gridColor}`;
  if (grid.userData.environmentKey !== gridKey) {
    const replacement = new THREE.GridHelper(gridSize, divisions, gridColor, gridColor);
    grid.geometry.dispose(); grid.material.dispose();
    grid.geometry = replacement.geometry; grid.material = replacement.material;
    grid.userData.environmentKey = gridKey;
  }
  ground.visible = presentation.visible;
  grid.visible = config ? config.gridVisible : presentation.gridVisible;
  ground.material.transparent = presentation.transparent;
  ground.material.opacity = presentation.opacity;
  ground.material.depthWrite = presentation.depthWrite;
  // A large translucent ground can sort after cabinet walls by its centre and
  // paint over their lower half. Draw the background ground before other blended
  // surfaces; opaque models still occlude it through the normal depth test.
  ground.renderOrder = presentation.transparent ? -1 : base.renderOrder;
  ground.material.clippingPlanes = presentation.sectioned ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), ground.position.z)] : [];
  ground.material.clipShadows = presentation.sectioned;
  ground.material.needsUpdate = true;
  renderer.localClippingEnabled = presentation.sectioned;
}
