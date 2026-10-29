import * as THREE from "three";

export function flipSensorRotation(rotation = {}) {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0));
  quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
  const result = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  return { x: result.x, y: result.y, z: result.z };
}

// Existing sensor markers face local -Y. Cameras face -Z; preserve saved poses.
export function makeSensorCamera(sensor) {
  const camera = new THREE.PerspectiveCamera(THREE.MathUtils.clamp(Number(sensor.fieldOfView) || 50, 10, 160), Math.max(.1, Number(sensor.aspectRatio) || 16 / 9), Math.max(.01, Number(sensor.near) || .1), Math.max(.2, Number(sensor.far) || 10));
  camera.rotation.x = -Math.PI / 2;
  camera.updateMatrixWorld();
  return camera;
}

export function applySensorView(camera, marker, sensor) {
  const source = makeSensorCamera(sensor);
  marker.updateWorldMatrix(true, false);
  camera.position.setFromMatrixPosition(marker.matrixWorld);
  camera.quaternion.copy(marker.getWorldQuaternion(new THREE.Quaternion())).multiply(source.quaternion);
  camera.zoom = 1; camera.fov = source.fov; camera.aspect = source.aspect; camera.near = source.near; camera.far = Math.max(source.far, source.near + .1);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}

// near is a clipping upper bound, not a physical blind zone. A scan may be only
// millimetres in front of the sensor, or straddle its origin at an enclosure.
export function fitSensorCameraNear(camera, roots) {
  let nearest = Infinity;
  const viewBounds = new THREE.Box3(), modelView = new THREE.Matrix4();
  const visit = (object) => {
    if (!object.visible || object.userData.monitoringOverlay || object.userData.sensorId) return;
    if ((object.isMesh || object.isPoints) && object.geometry) {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      object.updateWorldMatrix(true, false);
      modelView.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
      viewBounds.copy(object.geometry.boundingBox).applyMatrix4(modelView);
      if (viewBounds.min.z < 0) nearest = Math.min(nearest, Math.max(0, -viewBounds.max.z));
    }
    object.children.forEach(visit);
  };
  roots.filter(Boolean).forEach(visit);
  if (Number.isFinite(nearest)) {
    camera.near = Math.min(camera.near, Math.max(.0005, nearest * .25));
    camera.updateProjectionMatrix();
  }
}

export function sensorPoseFromCamera(camera, equipmentObject) {
  equipmentObject.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  const position = equipmentObject.worldToLocal(camera.getWorldPosition(new THREE.Vector3()));
  const orientation = equipmentObject.getWorldQuaternion(new THREE.Quaternion()).invert()
    .multiply(camera.getWorldQuaternion(new THREE.Quaternion()))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  const rotation = new THREE.Euler().setFromQuaternion(orientation, "XYZ");
  return { mountMode: "EQUIPMENT", surfaceMount: null, position: { x: position.x, y: position.y, z: position.z },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z }, fieldOfView: THREE.MathUtils.clamp(camera.getEffectiveFOV(), 10, 160) };
}
