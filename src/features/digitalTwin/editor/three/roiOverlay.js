import * as THREE from "three";

// Three.js sorts by groupOrder before renderOrder, and opaque/transparent
// objects have separate queues. ROI must be in the last transparent group;
// disabling depth tests alone would still let later image overlays cover it.
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
      material.depthTest = false;
      material.depthWrite = false;
      material.fog = false;
      material.toneMapped = false;
      if (node.isMesh) { material.side = THREE.DoubleSide; material.forceSinglePass = true; }
      material.needsUpdate = true;
    }
  });
  // Observation badges are added afterwards with renderOrder=Infinity,
  // keeping their numbers readable above every ROI fill and border.
  return group;
}
