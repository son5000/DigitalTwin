// Adapt the existing OrbitControls so button zoom and wheel/pinch share one camera.
export function bindViewerCamera(controls, onControlsChange, onZoomChange, onReset) {
  if (!onControlsChange) return () => {};
  const baselines = new WeakMap();
  function baseline() {
    const camera = controls.object;
    if (!baselines.has(camera)) baselines.set(camera, {
      distance: camera.position.distanceTo(controls.target), zoom: camera.zoom,
      position: camera.position.clone(), target: controls.target.clone(),
    });
    return baselines.get(camera);
  }
  function report() {
    const camera = controls.object;
    const initial = baseline();
    const ratio = camera.isOrthographicCamera ? camera.zoom / initial.zoom
      : initial.distance / Math.max(0.001, camera.position.distanceTo(controls.target));
    onZoomChange?.(Math.round(ratio * 100));
  }
  baseline();
  onControlsChange({
    zoomBy(factor) {
      const camera = controls.object;
      if (camera.isOrthographicCamera) {
        camera.zoom = Math.min(controls.maxZoom, Math.max(controls.minZoom, camera.zoom * factor));
        camera.updateProjectionMatrix();
      } else {
        const offset = camera.position.clone().sub(controls.target);
        offset.setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length() / factor)));
        camera.position.copy(controls.target).add(offset);
      }
      controls.update();
      report();
    },
    reset() {
      if (onReset) onReset();
      else {
        const initial = baseline();
        controls.object.position.copy(initial.position);
        controls.target.copy(initial.target);
        controls.object.zoom = initial.zoom;
        controls.object.updateProjectionMatrix();
        controls.update();
      }
      report();
    },
  });
  controls.addEventListener("change", report);
  report();
  return () => { controls.removeEventListener("change", report); onControlsChange(null); };
}
