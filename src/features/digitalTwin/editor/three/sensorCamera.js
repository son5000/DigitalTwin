import * as THREE from "three";

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
