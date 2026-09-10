import * as THREE from "three";
import { focusCameraOnObject } from "./cameraFocus.js";

const completed = new WeakMap();
const WIDTH = 640;
const HEIGHT = 400;

export function invalidateWorldSnapshot(request) {
  if (request) completed.delete(request);
}

function hasPendingTextures(roots) {
  let pending = false;
  roots.forEach((root) => root?.traverse((object) => {
    if (object.userData.userTexturePending) pending = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => Object.values(material).forEach((value) => {
      if (!value?.isTexture || value.isRenderTargetTexture) return;
      const image = value.source?.data;
      if (!image || image.complete === false) pending = true;
    }));
  }));
  return pending;
}

// Clone only render objects. Geometry/textures are borrowed; mutable materials are owned.
// Never toggle visibility, selection or materials on the live scene.
export function createSnapshotScene({ scene, roots, selectionColors = [] }) {
  const captureScene = new THREE.Scene();
  captureScene.background = scene.background?.isColor ? scene.background.clone() : scene.background;
  captureScene.environment = scene.environment;
  captureScene.environmentIntensity = scene.environmentIntensity;
  captureScene.environmentRotation.copy(scene.environmentRotation);
  const content = new THREE.Group();
  const materials = new Set();
  const colors = selectionColors.map((color) => new THREE.Color(color));
  function cloneObject(source) {
    if (!source.visible || source.userData.domain === "PART" || source.userData.portMarker) return null;
    // Runtime userData can contain mixers, promises and disposal callbacks; none belong in a snapshot.
    const renderSource = Object.create(source);
    renderSource.userData = {};
    const copy = source.isLOD ? new THREE.Group() : renderSource.clone(false);
    copy.position.copy(source.position);
    copy.quaternion.copy(source.quaternion);
    copy.scale.copy(source.scale);
    if (source.material) {
      const clean = (material) => {
        const next = material.clone();
        materials.add(next);
        if (colors.some((color) => next.emissive?.equals(color))) next.emissive.set(0);
        if (source.userData.siteObjectId && next.emissiveIntensity === 0.14 && next.emissive?.equals(next.color)) next.emissive.set(0);
        if (source.isLine && colors.some((color) => next.color?.equals(color))) copy.visible = false;
        return next;
      };
      copy.material = Array.isArray(source.material) ? source.material.map(clean) : clean(source.material);
    }
    source.children.forEach((child) => {
      const cloned = cloneObject(child);
      if (cloned) copy.add(cloned);
    });
    return copy;
  }
  roots.filter(Boolean).forEach((source) => {
    const copy = cloneObject(source);
    if (!copy) return;
    source.updateWorldMatrix(true, false);
    source.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
    content.add(copy);
  });
  captureScene.add(content);
  scene.children.filter((object) => object.isLight).forEach((light) => captureScene.add(light.clone()));
  return {
    scene: captureScene, content,
    dispose() {
      materials.forEach((material) => material.dispose());
      captureScene.children.forEach((object) => { object.shadow?.map?.dispose(); object.shadow?.mapPass?.dispose(); });
    },
  };
}

export function createSnapshotCamera(content, aspect = WIDTH / HEIGHT) {
  const camera = new THREE.PerspectiveCamera(42, aspect, 0.01, 10000);
  camera.position.set(1, 0.72, 1);
  const runtime = { camera, orbitControls: { target: new THREE.Vector3(), minDistance: 0.01, maxDistance: Infinity } };
  if (!focusCameraOnObject(runtime, content, { padding: 1.12 })) throw new Error("EMPTY_SNAPSHOT");
  camera.position.copy(runtime.cameraFocus.position);
  camera.lookAt(runtime.cameraFocus.target);
  const distance = camera.position.distanceTo(runtime.cameraFocus.target);
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = Math.max(distance * 10, 100);
  camera.updateProjectionMatrix();
  return camera;
}

export function captureWorldSnapshot({ renderer, ...options }) {
  const snapshot = createSnapshotScene(options);
  const target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const previous = {
    target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(), mip: renderer.getActiveMipmapLevel(),
    viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()),
    scissorTest: renderer.getScissorTest(), xr: renderer.xr.enabled, autoClear: renderer.autoClear,
  };
  try {
    const camera = createSnapshotCamera(snapshot.content);
    renderer.xr.enabled = false;
    renderer.autoClear = true;
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, WIDTH, HEIGHT);
    renderer.setScissorTest(false);
    renderer.render(snapshot.scene, camera);
    const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
    renderer.readRenderTargetPixels(target, 0, 0, WIDTH, HEIGHT, pixels);
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH; canvas.height = HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("SNAPSHOT_CANVAS_UNAVAILABLE");
    const image = context.createImageData(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y += 1) {
      image.data.set(pixels.subarray((HEIGHT - y - 1) * WIDTH * 4, (HEIGHT - y) * WIDTH * 4), y * WIDTH * 4);
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    renderer.setRenderTarget(previous.target, previous.face, previous.mip);
    renderer.setViewport(previous.viewport);
    renderer.setScissor(previous.scissor);
    renderer.setScissorTest(previous.scissorTest);
    renderer.xr.enabled = previous.xr;
    renderer.autoClear = previous.autoClear;
    target.dispose();
    snapshot.dispose();
  }
}

// The request is stable across selection/zoom changes and replaced for world/model changes.
export function scheduleWorldSnapshot({ request, getSource, isReady = () => true, onSnapshot }) {
  if (!request || !onSnapshot) return () => {};
  let timer;
  let cancelled = false;
  const started = Date.now();
  function capture() {
    if (cancelled) return;
    if (completed.has(request)) { onSnapshot({ request, url: completed.get(request) }); return; }
    try {
      const source = getSource();
      if (!source || !isReady() || hasPendingTextures(source.roots)) {
        if (Date.now() - started > 30000) throw new Error("SNAPSHOT_LOAD_TIMEOUT");
        timer = setTimeout(capture, 250);
        return;
      }
      const url = captureWorldSnapshot(source);
      completed.set(request, url);
      onSnapshot({ request, url });
    } catch (error) {
      console.warn("[월드 스냅샷] 장면을 촬영하지 못했습니다.", error);
      onSnapshot({ request, url: null, failed: true });
    }
  }
  timer = setTimeout(capture, 350);
  return () => { cancelled = true; clearTimeout(timer); };
}
