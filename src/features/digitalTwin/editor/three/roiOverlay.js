import * as THREE from "three";

// Draw after translucent textures, but respect the depth written by opaque
// equipment. An open door or a translucent shell leaves the ROI visible.
export function createRoiOverlay(object) {
  const group = object.isGroup ? object : new THREE.Group();
  if (group !== object) {
    group.userData = { ...object.userData };
    group.add(object);
  }
  group.traverse((node) => {
    node.userData.monitoringOverlay = true;
    node.renderOrder = node.isGroup ? Infinity : Number.MAX_SAFE_INTEGER - (node.isLine ? 0 : 1);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue;
      material.transparent = true;
      material.depthTest = true;
      material.depthWrite = false;
      material.fog = false;
      material.toneMapped = false;
      if (node.isMesh) {
        material.side = THREE.DoubleSide;
        material.forceSinglePass = true;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -2;
        material.polygonOffsetUnits = -2;
      }
      material.needsUpdate = true;
    }
  });
  // Observation badges are added afterwards with renderOrder=Infinity,
  // keeping their numbers readable above every ROI fill and border.
  return group;
}
