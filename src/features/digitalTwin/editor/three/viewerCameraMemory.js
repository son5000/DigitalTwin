import { Vector3 } from "three";
import { normalizeEquipmentView } from "../model/viewerPreset.js";

export function restoreEquipmentCamera(camera, controls, view, equipmentObject) {
  const snapshot = normalizeEquipmentView(view);
  if (!snapshot) return false;
  if (equipmentObject) {
    equipmentObject.updateWorldMatrix(true, false);
    snapshot.position = equipmentObject.localToWorld(new Vector3().fromArray(snapshot.position)).toArray();
    snapshot.target = equipmentObject.localToWorld(new Vector3().fromArray(snapshot.target)).toArray();
    snapshot.up = new Vector3().fromArray(snapshot.up).transformDirection(equipmentObject.matrixWorld).toArray();
  }
  return restoreViewerCamera(camera, controls, snapshot);
}

// Keep view changes separate from model/configuration changes. Scope keys contain
// only viewing targets and explicit fit requests, never editable sensor values.
export function captureViewerCamera(camera, controls) {
  return { position: camera.position.toArray(), target: controls.target.toArray(), up: camera.up.toArray(),
    zoom: camera.zoom, fov: camera.fov, near: camera.near, far: camera.far };
}

export function restoreViewerCamera(camera, controls, snapshot) {
  if (!snapshot) return false;
  camera.position.fromArray(snapshot.position);
  camera.up.fromArray(snapshot.up);
  camera.zoom = snapshot.zoom;
  if (Number.isFinite(snapshot.fov)) camera.fov = snapshot.fov;
  camera.near = snapshot.near;
  camera.far = snapshot.far;
  controls.target.fromArray(snapshot.target);
  camera.updateProjectionMatrix();
  // Flush residual damping from the previous target before restoring the pose.
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  camera.position.fromArray(snapshot.position);
  camera.zoom = snapshot.zoom;
  controls.target.fromArray(snapshot.target);
  camera.updateProjectionMatrix();
  controls.update();
  controls.enableDamping = damping;
  return true;
}

export function rememberViewerCamera(memory, key, camera, controls, extra = {}) {
  memory.set(key, { ...captureViewerCamera(camera, controls), ...extra });
  if (memory.size > 32) memory.delete(memory.keys().next().value);
}
