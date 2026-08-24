import * as THREE from "three";

const DEFAULT_PADDING = 1.35;
const DEFAULT_FRONT_PADDING = 1.08;
const POSITION_EPSILON = 0.025;
const TARGET_EPSILON = 0.025;
const ZOOM_EPSILON = 0.002;

function getViewDirection(camera, controls) {
  const direction = camera.position.clone().sub(controls.target);
  if (direction.lengthSq() > 1e-8) return direction.normalize();
  camera.getWorldDirection(direction);
  return direction.multiplyScalar(-1).normalize();
}

function getPerspectiveFitDistance(camera, radius, padding) {
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.01));
  const limitingFov = Math.max(THREE.MathUtils.degToRad(1), Math.min(verticalFov, horizontalFov));
  return radius / Math.sin(limitingFov / 2) * padding;
}

function getOrthographicFitZoom(camera, radius, padding) {
  const diameter = Math.max(radius * 2 * padding, 0.01);
  const frustumWidth = Math.abs(camera.right - camera.left);
  const frustumHeight = Math.abs(camera.top - camera.bottom);
  return Math.min(frustumWidth, frustumHeight) / diameter;
}

function parseDirection(value) {
  if (value?.isVector3) return value.clone();
  if (Array.isArray(value) && value.length >= 3) {
    return new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  }
  if (value && typeof value === "object") {
    return new THREE.Vector3(Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0);
  }
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/\s+/g, "");
  return {
    "+X": new THREE.Vector3(1, 0, 0), X: new THREE.Vector3(1, 0, 0), RIGHT: new THREE.Vector3(1, 0, 0),
    "-X": new THREE.Vector3(-1, 0, 0), LEFT: new THREE.Vector3(-1, 0, 0),
    "+Z": new THREE.Vector3(0, 0, 1), Z: new THREE.Vector3(0, 0, 1), FORWARD: new THREE.Vector3(0, 0, 1), FRONT: new THREE.Vector3(0, 0, 1),
    "-Z": new THREE.Vector3(0, 0, -1), BACK: new THREE.Vector3(0, 0, -1), BACKWARD: new THREE.Vector3(0, 0, -1),
  }[normalized] ?? null;
}

function getWorldFrontDirection(object, directionValue, directionSpace) {
  const direction = parseDirection(directionValue) ?? new THREE.Vector3(0, 0, 1);
  const isWorldSpace = String(directionSpace ?? "").toUpperCase() === "WORLD";
  if (!isWorldSpace) direction.applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
  direction.y = 0;
  if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
  return direction.normalize();
}

function getBoundsExtents(bounds, center, right, up, front) {
  let halfWidth = 0;
  let halfHeight = 0;
  let halfDepth = 0;
  const corner = new THREE.Vector3();
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corner.set(x, y, z).sub(center);
        halfWidth = Math.max(halfWidth, Math.abs(corner.dot(right)));
        halfHeight = Math.max(halfHeight, Math.abs(corner.dot(up)));
        halfDepth = Math.max(halfDepth, Math.abs(corner.dot(front)));
      }
    }
  }
  return { halfWidth, halfHeight, halfDepth };
}

function getSafeHalfRatio(total, startInset = 0, endInset = 0) {
  if (!total) return 1;
  const safeHalf = Math.max(1, Math.min(total / 2 - startInset, total / 2 - endInset));
  return THREE.MathUtils.clamp(safeHalf / (total / 2), 0.18, 1);
}

export function cancelCameraFocus(runtime) {
  if (runtime) runtime.cameraFocus = null;
}

export function focusCameraOnObject(runtime, object, { padding = DEFAULT_PADDING } = {}) {
  const camera = runtime?.activeCamera ?? runtime?.camera;
  const controls = runtime?.orbitControls;
  if (!runtime || !object || !camera || !controls) return false;

  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return false;

  const center = bounds.getCenter(new THREE.Vector3());
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.1);
  const viewDirection = getViewDirection(camera, controls);
  const currentDistance = Math.max(camera.position.distanceTo(controls.target), 0.1);
  let targetDistance = currentDistance;
  let targetZoom = null;

  if (camera.isPerspectiveCamera) {
    targetDistance = THREE.MathUtils.clamp(
      getPerspectiveFitDistance(camera, radius, padding),
      controls.minDistance || 0.1,
      Number.isFinite(controls.maxDistance) ? controls.maxDistance : Infinity,
    );
  } else if (camera.isOrthographicCamera) {
    targetZoom = THREE.MathUtils.clamp(
      getOrthographicFitZoom(camera, radius, padding),
      controls.minZoom || 0.01,
      Number.isFinite(controls.maxZoom) ? controls.maxZoom : 100,
    );
  }

  runtime.cameraFocus = {
    camera,
    position: center.clone().addScaledVector(viewDirection, targetDistance),
    target: center,
    zoom: targetZoom,
  };
  return true;
}

export function focusCameraOnObjectFront(runtime, object, {
  direction,
  directionSpace,
  padding = DEFAULT_FRONT_PADDING,
  viewportInsets = {},
} = {}) {
  const camera = runtime?.perspectiveCamera ?? runtime?.activeCamera;
  const controls = runtime?.orbitControls;
  if (!runtime || !object || !camera?.isPerspectiveCamera || !controls) return false;

  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return false;

  const center = bounds.getCenter(new THREE.Vector3());
  const front = getWorldFrontDirection(object, direction, directionSpace);
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, front).normalize();
  const { halfWidth, halfHeight, halfDepth } = getBoundsExtents(bounds, center, right, up, front);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.01));
  const canvasBounds = runtime.renderer.domElement.getBoundingClientRect();
  const horizontalRatio = getSafeHalfRatio(canvasBounds.width, viewportInsets.left, viewportInsets.right);
  const verticalRatio = getSafeHalfRatio(canvasBounds.height, viewportInsets.top, viewportInsets.bottom);
  const horizontalDistance = halfWidth * padding / Math.max(Math.tan(horizontalFov / 2) * horizontalRatio, 1e-4);
  const verticalDistance = halfHeight * padding / Math.max(Math.tan(verticalFov / 2) * verticalRatio, 1e-4);
  const targetDistance = THREE.MathUtils.clamp(
    Math.max(horizontalDistance, verticalDistance) + halfDepth,
    controls.minDistance || 0.1,
    Number.isFinite(controls.maxDistance) ? controls.maxDistance : Infinity,
  );
  const radius = Math.max(bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.1);

  camera.near = Math.max(0.05, Math.min(camera.near, targetDistance - radius * 1.5));
  camera.far = Math.max(camera.far, targetDistance + radius * 4);
  camera.updateProjectionMatrix();
  runtime.cameraFocus = {
    camera,
    position: center.clone().addScaledVector(front, targetDistance),
    target: center,
    zoom: null,
  };
  return true;
}

export function updateCameraFocus(runtime, smoothing = 0.12) {
  const focus = runtime?.cameraFocus;
  const camera = runtime?.activeCamera ?? runtime?.camera;
  const controls = runtime?.orbitControls;
  if (!focus || !camera || !controls || focus.camera !== camera) {
    cancelCameraFocus(runtime);
    return;
  }

  camera.position.lerp(focus.position, smoothing);
  controls.target.lerp(focus.target, smoothing);
  if (focus.zoom !== null && camera.isOrthographicCamera) {
    camera.zoom = THREE.MathUtils.lerp(camera.zoom, focus.zoom, smoothing);
    camera.updateProjectionMatrix();
  }

  const positionReady = camera.position.distanceToSquared(focus.position) < POSITION_EPSILON ** 2;
  const targetReady = controls.target.distanceToSquared(focus.target) < TARGET_EPSILON ** 2;
  const zoomReady = focus.zoom === null || Math.abs(camera.zoom - focus.zoom) < ZOOM_EPSILON;
  if (!positionReady || !targetReady || !zoomReady) return;

  camera.position.copy(focus.position);
  controls.target.copy(focus.target);
  if (focus.zoom !== null && camera.isOrthographicCamera) {
    camera.zoom = focus.zoom;
    camera.updateProjectionMatrix();
  }
  cancelCameraFocus(runtime);
}

export function bindCameraFocusCancellation(runtime, element) {
  const cancel = () => cancelCameraFocus(runtime);
  runtime.orbitControls.enableZoom = true;
  runtime.orbitControls.addEventListener("start", cancel);
  element.addEventListener("pointerdown", cancel);
  element.addEventListener("wheel", cancel, { passive: true });
  element.addEventListener("touchstart", cancel, { passive: true });

  return () => {
    runtime.orbitControls.removeEventListener("start", cancel);
    element.removeEventListener("pointerdown", cancel);
    element.removeEventListener("wheel", cancel);
    element.removeEventListener("touchstart", cancel);
  };
}
