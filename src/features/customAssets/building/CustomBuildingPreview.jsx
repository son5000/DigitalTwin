import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { disposeObject3D } from "@/features/digitalTwin/editor/three/disposeObject3D";
import {
  attachDualTransformControls,
  configureDualTransformControls,
  createDualTransformControls,
  DEFAULT_TRANSFORM_TOOLS,
  detachDualTransformControls,
  disposeDualTransformControls,
  setDualTransformDragging,
} from "@/features/digitalTwin/editor/three/dualTransformControls";
import { createCustomBuildingGroup } from "./buildingRenderer";
import styles from "./CustomBuildingEditor.module.css";

const CAMERA_PRESETS = {
  ISO: [38, 30, 38],
  FRONT: [0, 18, 48],
  SIDE: [48, 18, 0],
  TOP: [0.01, 62, 0.01],
};

function fitDirectionalShadow(light, modelRadius) {
  const extent = Math.max(24, modelRadius * 1.45);
  const shadowCamera = light.shadow.camera;
  shadowCamera.left = -extent;
  shadowCamera.right = extent;
  shadowCamera.top = extent;
  shadowCamera.bottom = -extent;
  shadowCamera.near = 0.5;
  shadowCamera.far = Math.max(160, modelRadius * 8);
  shadowCamera.updateProjectionMatrix();
  light.shadow.bias = -0.0002;
  light.shadow.normalBias = 0.08;
}

function findTransformObject(model, entityId) {
  let match = null;
  model?.traverse((object) => {
    if (!match && object.isMesh && object.userData.customEntityId === entityId && object.userData.customEntityType === "mass") match = object;
  });
  return match;
}

export default function CustomBuildingPreview({
  asset,
  selectedEntityId,
  theme,
  viewGroupId = null,
  viewMode = "ALL",
  explode = false,
  minVisibleElevation = null,
  maxVisibleElevation = null,
  cameraFocusKey = 0,
  transformTools = DEFAULT_TRANSFORM_TOOLS,
  snapEnabled = true,
  snapSize = 0.5,
  transformEnabled = true,
  onSelectEntity,
  onTransformEntity,
}) {
  const hostRef = useRef(null);
  const runtimeRef = useRef(null);
  const selectEntityRef = useRef(onSelectEntity);
  const transformEntityRef = useRef(onTransformEntity);
  const framedAssetRef = useRef(null);

  useEffect(() => { selectEntityRef.current = onSelectEntity; }, [onSelectEntity]);
  useEffect(() => { transformEntityRef.current = onTransformEntity; }, [onTransformEntity]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const scene = new THREE.Scene();
    const sceneTheme = SCENE_THEMES.dark;
    scene.background = new THREE.Color(sceneTheme.background);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 5000);
    camera.position.set(...CAMERA_PRESETS.ISO);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("role", "application");
    renderer.domElement.setAttribute("aria-label", "커스텀 건축물 실시간 3D 미리보기");
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 8, 0);
    const sun = new THREE.DirectionalLight(sceneTheme.keyLight, 2.2);
    sun.position.set(28, 42, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const hemisphere = new THREE.HemisphereLight(sceneTheme.hemisphereSky, sceneTheme.hemisphereGround, 1.7);
    scene.add(hemisphere, sun);
    const grid = new THREE.GridHelper(120, 60, sceneTheme.worldEdge, sceneTheme.grid);
    scene.add(grid);
    const transformControls = createDualTransformControls(camera, renderer.domElement, scene, { translationSnap: 0.5 });
    const runtime = {
      scene, camera, renderer, controls, transformControls, grid, hemisphere, sun,
      model: null, frame: 0, transformTools: DEFAULT_TRANSFORM_TOOLS, snapEnabled: true, snapSize: 0.5, transformEnabled: true, explode: false,
    };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart = null;
    const onPointerDown = (event) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const onPointerUp = (event) => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
      if (!runtime.model) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(runtime.model, true).find((item) => {
        let object = item.object;
        while (object && !object.userData.customEntityId) object = object.parent;
        return object?.userData.customEntityId;
      });
      if (!hit) return;
      let object = hit.object;
      while (object && !object.userData.customEntityId) object = object.parent;
      selectEntityRef.current?.(object.userData.customEntityId, event.ctrlKey || event.metaKey);
    };
    const commitTransform = (activeControl) => {
      const object = activeControl.object;
      if (!object?.userData.customEntityId) return;
      const explodeFactor = runtime.explode ? 1.18 : 1;
      const clean = (value) => Math.round(value * 1000) / 1000;
      transformEntityRef.current?.(object.userData.customEntityId, {
        position: {
          x: clean(object.position.x / explodeFactor),
          z: clean(object.position.z / explodeFactor),
        },
        rotationY: clean(THREE.MathUtils.radToDeg(object.rotation.y)),
      });
    };
    const handleDraggingChanged = (activeControl, event) => {
      controls.enabled = !event.value;
      if (event.value) pointerStart = null;
      setDualTransformDragging(transformControls, activeControl, event.value, runtime.transformTools);
    };
    const handleTranslateCommit = () => commitTransform(transformControls.translate);
    const handleRotateCommit = () => commitTransform(transformControls.rotate);
    const handleTranslateDragging = (event) => handleDraggingChanged(transformControls.translate, event);
    const handleRotateDragging = (event) => handleDraggingChanged(transformControls.rotate, event);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    transformControls.translate.addEventListener("mouseUp", handleTranslateCommit);
    transformControls.rotate.addEventListener("mouseUp", handleRotateCommit);
    transformControls.translate.addEventListener("dragging-changed", handleTranslateDragging);
    transformControls.rotate.addEventListener("dragging-changed", handleRotateDragging);
    runtimeRef.current = runtime;
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = Math.max(0.1, width / Math.max(1, height));
      camera.updateProjectionMatrix();
    };
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    });
    observer.observe(host);
    resize();
    const animate = () => { controls.update(); renderer.render(scene, camera); runtime.frame = requestAnimationFrame(animate); };
    animate();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(runtime.frame);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      transformControls.translate.removeEventListener("mouseUp", handleTranslateCommit);
      transformControls.rotate.removeEventListener("mouseUp", handleRotateCommit);
      transformControls.translate.removeEventListener("dragging-changed", handleTranslateDragging);
      transformControls.rotate.removeEventListener("dragging-changed", handleRotateDragging);
      disposeDualTransformControls(transformControls);
      controls.dispose();
      if (runtime.model) disposeObject3D(runtime.model);
      disposeObject3D(runtime.grid);
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.transformTools = transformTools;
    runtime.snapEnabled = snapEnabled;
    runtime.snapSize = snapSize;
    runtime.transformEnabled = transformEnabled;
    runtime.transformControls.translate.setTranslationSnap(snapEnabled ? snapSize : null);
    configureDualTransformControls(runtime.transformControls, transformEnabled ? transformTools : { translate: false, rotate: false });
    const selectedObject = findTransformObject(runtime.model, selectedEntityId);
    if (selectedObject && transformEnabled && !runtime.explode) attachDualTransformControls(runtime.transformControls, selectedObject, transformTools);
    else detachDualTransformControls(runtime.transformControls);
  }, [selectedEntityId, snapEnabled, snapSize, transformEnabled, transformTools]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const sceneTheme = SCENE_THEMES[theme] ?? SCENE_THEMES.dark;
    runtime.scene.background.setHex(sceneTheme.background);
    runtime.hemisphere.color.setHex(sceneTheme.hemisphereSky);
    runtime.hemisphere.groundColor.setHex(sceneTheme.hemisphereGround);
    runtime.sun.color.setHex(sceneTheme.keyLight);
    const materials = Array.isArray(runtime.grid.material) ? runtime.grid.material : [runtime.grid.material];
    materials[0]?.color.setHex(sceneTheme.worldEdge);
    materials[1]?.color.setHex(sceneTheme.grid);
  }, [theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !asset) return;
    detachDualTransformControls(runtime.transformControls);
    if (runtime.model) { runtime.scene.remove(runtime.model); disposeObject3D(runtime.model); }
    const sceneTheme = SCENE_THEMES[theme] ?? SCENE_THEMES.dark;
    runtime.model = createCustomBuildingGroup(asset, {
      selectedEntityId,
      selectionColor: sceneTheme.selection,
      edgeColor: sceneTheme.worldEdge,
      viewGroupId,
      viewMode,
      explode,
      minVisibleElevation,
      maxVisibleElevation,
    });
    runtime.scene.add(runtime.model);
    runtime.explode = explode;
    const selectedObject = findTransformObject(runtime.model, selectedEntityId);
    if (selectedObject && runtime.transformEnabled && !explode) attachDualTransformControls(runtime.transformControls, selectedObject, runtime.transformTools);
    const box = new THREE.Box3().setFromObject(runtime.model);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    runtime.modelRadius = Math.max(1, sphere.radius);
    fitDirectionalShadow(runtime.sun, runtime.modelRadius);
    const framingKey = `${asset.id}:${cameraFocusKey}`;
    if (framedAssetRef.current !== framingKey) {
      framedAssetRef.current = framingKey;
      runtime.controls.target.copy(sphere.center);
      runtime.controls.target.y -= asset.bounds.height * 0.52;
      const distance = runtime.modelRadius / Math.sin(THREE.MathUtils.degToRad(runtime.camera.fov / 2)) * 2.4;
      const direction = runtime.camera.position.clone().sub(runtime.controls.target).normalize();
      runtime.camera.position.copy(runtime.controls.target).add(direction.multiplyScalar(Math.max(12, distance)));
      runtime.camera.near = Math.max(0.05, distance / 1000);
      runtime.camera.far = Math.max(500, distance * 20);
      runtime.camera.updateProjectionMatrix();
    }
  }, [asset, cameraFocusKey, explode, maxVisibleElevation, minVisibleElevation, selectedEntityId, theme, viewGroupId, viewMode]);

  function setPreset(id) {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const distance = (runtime.modelRadius ?? Math.max(asset.bounds.width, asset.bounds.depth, asset.bounds.height))
      / Math.sin(THREE.MathUtils.degToRad(runtime.camera.fov / 2)) * 2.4;
    const vector = new THREE.Vector3(...CAMERA_PRESETS[id]).normalize().multiplyScalar(Math.max(12, distance));
    runtime.camera.position.copy(runtime.controls.target).add(vector);
    runtime.camera.up.set(0, 1, 0);
    runtime.controls.update();
  }

  return (
    <div className={styles.previewHost} ref={hostRef}>
      <div className={styles.cameraPresets} aria-label="카메라 프리셋">
        <button type="button" onClick={() => setPreset("ISO")}>ISO</button>
        <button type="button" onClick={() => setPreset("FRONT")}>정면</button>
        <button type="button" onClick={() => setPreset("SIDE")}>측면</button>
        <button type="button" onClick={() => setPreset("TOP")}>평면</button>
      </div>
      <span className={styles.previewScale}>{asset.bounds.width.toFixed(1)} × {asset.bounds.depth.toFixed(1)} × {asset.bounds.height.toFixed(1)} m</span>
    </div>
  );
}
