// Rotate the plan's viewing direction without changing world coordinates or zoom.
export function rotatePlanView(camera, controls, degrees) {
  const angle = degrees * Math.PI / 180;
  camera.up.set(Math.sin(angle), 0, -Math.cos(angle));
  camera.lookAt(controls.target);
  camera.updateMatrixWorld(true);
  controls.update();
}
