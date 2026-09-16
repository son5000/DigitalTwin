import * as THREE from "three";
import { focusCameraOnBounds } from "./cameraFocus.js";

export function equipmentWorldBounds(root, equipmentId = null) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  root.traverseVisible((mesh) => {
    if (!mesh.isMesh || mesh.userData.portMarker || mesh.userData.guide) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (mesh.isInstancedMesh) {
      const ids = mesh.userData.equipmentInstanceIds;
      for (let index = 0; index < mesh.count; index += 1) {
        if (equipmentId && ids?.[index] !== equipmentId) continue;
        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(index, matrix);
        bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix.premultiply(mesh.matrixWorld)));
      }
      return;
    }
    if (equipmentId) {
      let owner = mesh;
      while (owner && owner !== root && owner.userData.equipmentId !== equipmentId) owner = owner.parent;
      if (owner?.userData.equipmentId !== equipmentId) return;
    }
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  });
  return bounds;
}

function cameraInsets(container) {
  const result = { left: 0, right: 0, top: 0, bottom: 0 };
  const area = container?.closest?.("[data-scene-area]");
  if (!area) return result;
  const canvas = container.getBoundingClientRect();
  area.parentElement?.querySelectorAll("[data-camera-safe-ui]").forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.right <= canvas.left || rect.left >= canvas.right || rect.bottom <= canvas.top || rect.top >= canvas.bottom) return;
    const edge = element.getAttribute("data-camera-safe-ui");
    const values = { left: rect.right - canvas.left, right: canvas.right - rect.left, top: rect.bottom - canvas.top, bottom: canvas.bottom - rect.top };
    if (edge in result) result[edge] = Math.max(result[edge], values[edge] + 12);
  });
  return result;
}

export function focusEquipmentInWorld(runtime, root, item, { equipmentId = null, parent = null, viewportInsets = null } = {}) {
  const bounds = equipmentWorldBounds(root, equipmentId);
  const metadata = item.metadata ?? {};
  const axis = item.frontDirection ?? item.forward ?? item.frontAxis ?? metadata.frontDirection ?? metadata.frontAxis;
  const axes = { X: [1, 0, 0], "+X": [1, 0, 0], "-X": [-1, 0, 0], Z: [0, 0, 1], "+Z": [0, 0, 1], "-Z": [0, 0, -1] };
  const direction = new THREE.Vector3(...(axes[axis] ?? (Array.isArray(axis) ? axis : [0, 0, 1])));
  if ((item.frontDirectionSpace ?? metadata.frontDirectionSpace) !== "WORLD") {
    if (parent) {
      direction.applyEuler(new THREE.Euler(item.rotation?.x ?? 0, item.rotation?.y ?? 0, item.rotation?.z ?? 0));
      direction.applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()));
    } else direction.applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
  }
  return focusCameraOnBounds(runtime, bounds, { direction, duration: 700, padding: 1.05, viewportInsets: viewportInsets ?? cameraInsets(runtime.container) });
}

// A small selected object must not determine the far plane for the whole world.
export function updateViewerCameraRange(camera, bounds) {
  if (bounds.isEmpty()) return;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const distance = camera.position.distanceTo(sphere.center);
  const far = Math.max(100, (distance + sphere.radius) * 1.2);
  const near = Math.min(0.1, Math.max(0.001, (distance - sphere.radius) / 1000));
  if (Math.abs(camera.far - far) < 0.01 && Math.abs(camera.near - near) < 0.0001) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}
