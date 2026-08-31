import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { TRANSFORM_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { getMoveAxisConfiguration } from "@/features/digitalTwin/editor/constants/transformTools";
import {
  formatGridResolution,
  getGridRegionsForScope,
  getGridResolutionAtPosition,
  snapHorizontalPosition,
} from "@/features/digitalTwin/editor/constants/gridSettings";
import { createPartObject, getPartSignature } from "@/features/digitalTwin/editor/world/PartFactory";
import {
  createGridRegionGuide,
  createGridSnapMarker,
  updateGridSnapMarker,
} from "@/features/digitalTwin/editor/world/GridGuideFactory";

import { disposeObject3D } from "./disposeObject3D";
import styles from "./PartEditorScene.module.css";

function resize(runtime) {
  const { width, height } = runtime.container.getBoundingClientRect();
  if (!width || !height) return;
  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

function pointerFromEvent(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
}

function configureTransformControls(controls, mode, moveAxisMode) {
  controls.setMode(mode);
  const moveAxes = getMoveAxisConfiguration({ moveAxisMode });
  const translating = mode === TRANSFORM_MODES.TRANSLATE;
  controls.enabled = translating ? moveAxes.enabled : true;
  controls.showX = translating ? moveAxes.showX : false;
  controls.showY = translating ? moveAxes.showY : true;
  controls.showZ = translating ? moveAxes.showZ : false;
  controls.getHelper().visible = controls.enabled && Boolean(controls.object);
}

export default function PartEditorScene({
  equipment,
  selectedPartId,
  theme,
  transformMode,
  moveAxisMode,
  gridSettings,
  gridScopeId,
  onSelectPart,
  onUpdatePart,
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const gridSettingsRef = useRef(gridSettings);
  const gridScopeIdRef = useRef(gridScopeId);
  const [dragSnapSize, setDragSnapSize] = useState(null);
  const handlersRef = useRef({ onSelectPart, onUpdatePart });

  useEffect(() => { handlersRef.current = { onSelectPart, onUpdatePart }; }, [onSelectPart, onUpdatePart]);

  useEffect(() => {
    gridSettingsRef.current = gridSettings;
    gridScopeIdRef.current = gridScopeId;
  }, [gridScopeId, gridSettings]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const initialTheme = SCENE_THEMES.dark;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialTheme.background);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Equipment Part 상세 편집 화면");
    renderer.domElement.setAttribute("role", "application");
    container.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 250);
    const maxDimension = Math.max(equipment.dimensions.width, equipment.dimensions.height, equipment.dimensions.depth);
    camera.position.set(maxDimension * 2.2, maxDimension * 1.6, maxDimension * 2.2);
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(0, equipment.dimensions.height * 0.5, 0);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.minDistance = maxDimension * 0.8;
    orbitControls.maxDistance = maxDimension * 12;
    orbitControls.update();
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setTranslationSnap(null);
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(5));
    scene.add(transformControls.getHelper());
    const partRoot = new THREE.Group();
    scene.add(partRoot);
    const envelope = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(equipment.dimensions.width, equipment.dimensions.height, equipment.dimensions.depth)),
      new THREE.LineDashedMaterial({ color: 0x668795, transparent: true, opacity: 0.55, dashSize: 0.08, gapSize: 0.05 }),
    );
    envelope.position.y = equipment.dimensions.height / 2;
    envelope.computeLineDistances();
    scene.add(envelope);
    const grid = new THREE.GridHelper(maxDimension * 6, 36, 0x4f7180, 0x263d47);
    scene.add(grid);
    const gridRegionRoot = new THREE.Group();
    scene.add(gridRegionRoot);
    const gridSnapMarker = createGridSnapMarker(initialTheme.selection);
    scene.add(gridSnapMarker);
    const hemisphereLight = new THREE.HemisphereLight(initialTheme.hemisphereSky, initialTheme.hemisphereGround, 1.9);
    scene.add(hemisphereLight);
    const keyLight = new THREE.DirectionalLight(initialTheme.keyLight, 2.5);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(initialTheme.fillLight, 0.8);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);
    const runtime = {
      container, scene, renderer, camera, orbitControls, transformControls, partRoot,
      partObjects: new Map(), envelope, grid, hemisphereLight, keyLight, fillLight,
      gridRegionRoot, gridSnapMarker, dragging: false,
    };
    runtimeRef.current = runtime;
    const raycaster = new THREE.Raycaster();
    const pointerStart = new THREE.Vector2();
    function handlePointerDown(event) { pointerStart.set(event.clientX, event.clientY); }
    function handlePointerUp(event) {
      if (event.button !== 0 || pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5 || transformControls.axis) return;
      raycaster.setFromCamera(pointerFromEvent(event, renderer.domElement), camera);
      const [intersection] = raycaster.intersectObjects(partRoot.children, true);
      handlersRef.current.onSelectPart(intersection?.object.userData.partId ?? intersection?.object.parent?.userData.partId ?? null);
    }
    function handleObjectChange() {
      const object = transformControls.object;
      if (!object?.userData.partId) return;
      if (transformControls.mode === TRANSFORM_MODES.TRANSLATE) {
        const { position, cellSize } = snapHorizontalPosition(object.position, gridSettingsRef.current, gridScopeIdRef.current);
        object.position.x = position.x;
        object.position.z = position.z;
        updateGridSnapMarker(runtime.gridSnapMarker, position, runtime.dragging && cellSize !== null);
        setDragSnapSize((current) => current === cellSize ? current : cellSize);
      }
      handlersRef.current.onUpdatePart(object.userData.partId, {
        position: {
          x: object.position.x / equipment.dimensions.width,
          y: object.position.y / equipment.dimensions.height,
          z: object.position.z / equipment.dimensions.depth,
        },
        rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
      });
    }
    function handleDragging(event) {
      orbitControls.enabled = !event.value;
      runtime.dragging = event.value;
      if (!event.value) {
        updateGridSnapMarker(runtime.gridSnapMarker, { x: 0, z: 0 }, false);
        setDragSnapSize(null);
      }
    }
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    transformControls.addEventListener("objectChange", handleObjectChange);
    transformControls.addEventListener("dragging-changed", handleDragging);
    const resizeObserver = new ResizeObserver(() => resize(runtime));
    resizeObserver.observe(container);
    resize(runtime);
    let frameId;
    function render() {
      orbitControls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    render();
    return () => {
      runtimeRef.current = null;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      transformControls.removeEventListener("objectChange", handleObjectChange);
      transformControls.removeEventListener("dragging-changed", handleDragging);
      transformControls.detach();
      transformControls.dispose();
      orbitControls.dispose();
      runtime.partObjects.forEach(disposeObject3D);
      disposeObject3D(envelope);
      disposeObject3D(runtime.gridRegionRoot);
      disposeObject3D(runtime.gridSnapMarker);
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [equipment.dimensions.depth, equipment.dimensions.height, equipment.dimensions.width]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.gridRegionRoot.children.forEach(disposeObject3D);
    runtime.gridRegionRoot.clear();
    if (!gridSettings.enabled) return;
    const sceneTheme = SCENE_THEMES[theme];
    getGridRegionsForScope(gridSettings, gridScopeId)
      .filter((region) => region.enabled)
      .forEach((region) => runtime.gridRegionRoot.add(createGridRegionGuide(region, {
        lineColor: sceneTheme.selection,
        boundaryColor: sceneTheme.worldSelection,
      })));
  }, [gridScopeId, gridSettings, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const sceneTheme = SCENE_THEMES[theme];
    runtime.scene.background.set(sceneTheme.background);
    runtime.hemisphereLight.color.set(sceneTheme.hemisphereSky);
    runtime.hemisphereLight.groundColor.set(sceneTheme.hemisphereGround);
    runtime.keyLight.color.set(sceneTheme.keyLight);
    runtime.fillLight.color.set(sceneTheme.fillLight);
  }, [theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const parts = equipment.parts ?? [];
    const expectedIds = new Set(parts.map((part) => part.id));
    runtime.partObjects.forEach((object, partId) => {
      if (!expectedIds.has(partId)) {
        if (runtime.transformControls.object === object) runtime.transformControls.detach();
        runtime.partRoot.remove(object);
        disposeObject3D(object);
        runtime.partObjects.delete(partId);
      }
    });
    parts.forEach((part) => {
      const selected = part.id === selectedPartId;
      const signature = getPartSignature(part, equipment, selected, theme);
      let object = runtime.partObjects.get(part.id);
      if (!object || object.userData.geometrySignature !== signature) {
        if (object) {
          if (runtime.transformControls.object === object) runtime.transformControls.detach();
          runtime.partRoot.remove(object);
          disposeObject3D(object);
        }
        object = createPartObject(part, equipment, { selected, theme, selectionColor: SCENE_THEMES[theme].selection });
        runtime.partObjects.set(part.id, object);
        runtime.partRoot.add(object);
      }
    });
    const selectedObject = runtime.partObjects.get(selectedPartId);
    const selectedPart = parts.find((part) => part.id === selectedPartId);
    if (selectedObject && !selectedPart?.locked) runtime.transformControls.attach(selectedObject);
    else runtime.transformControls.detach();
    configureTransformControls(runtime.transformControls, transformMode, moveAxisMode);
  }, [equipment, moveAxisMode, selectedPartId, theme, transformMode]);

  useEffect(() => {
    const controls = runtimeRef.current?.transformControls;
    if (controls) configureTransformControls(controls, transformMode, moveAxisMode);
  }, [moveAxisMode, transformMode]);

  const selectedPart = equipment.parts?.find((part) => part.id === selectedPartId);
  const selectedPosition = selectedPart ? {
    x: selectedPart.position.x * equipment.dimensions.width,
    y: selectedPart.position.y * equipment.dimensions.height,
    z: selectedPart.position.z * equipment.dimensions.depth,
  } : null;
  const effectiveSnapSize = gridSettings.enabled
    ? dragSnapSize ?? getGridResolutionAtPosition(gridSettings, gridScopeId, selectedPosition)
    : null;

  return (
    <section className={styles.viewport}>
      <div ref={containerRef} className={styles.canvasMount} />
      <div className={styles.status}><span /> 파트 상세 · 필요 시 로드</div>
      {effectiveSnapSize !== null && <div className={styles.gridSnapStatus}>GRID SNAP · {formatGridResolution(effectiveSnapSize)}</div>}
      <div className={styles.axis} aria-hidden="true"><b>X</b><b>Y</b><b>Z</b><span>미터</span></div>
    </section>
  );
}
