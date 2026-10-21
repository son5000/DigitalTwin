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
  camera.fov = source.fov; camera.aspect = source.aspect; camera.near = source.near; camera.far = Math.max(source.far, source.near + .1);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
