import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { TRANSFORM_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import {
  formatGridResolution,
  getGridRegionsForScope,
  getGridResolutionAtPosition,
  snapHorizontalPosition,
} from "@/features/digitalTwin/editor/constants/gridSettings";
import {
  createRoomLayoutObject,
  getRoomLayoutSignature,
  getRoomScene,
} from "@/features/digitalTwin/editor/world/RoomLayoutFactory";
import {
  createGridRegionGuide,
  createGridSnapMarker,
  updateGridSnapMarker,
} from "@/features/digitalTwin/editor/world/GridGuideFactory";

import { disposeObject3D } from "./disposeObject3D";
import styles from "./FloorOverviewScene.module.css";

const FLOOR_THEMES = {
  light: { grid: 0xa8b7c0, gridCenter: 0x718996, boundary: 0x8096a1, edge: 0x607987, equipment: 0x367f98 },
  dark: { grid: 0x29434f, gridCenter: 0x517483, boundary: 0x607f8d, edge: 0x7896a3, equipment: 0x56a6b7 },
};

function getPointer(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
}

function findRoomId(object, root) {
  let current = object;
  while (current && current !== root) {
    if (current.userData.roomId) return current.userData.roomId;
    current = current.parent;
  }
  return null;
}

function resizeRuntime(runtime) {
  const { width, height } = runtime.container.getBoundingClientRect();
  if (!width || !height) return;
  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

function configureTransformControls(controls, mode) {
  controls.setMode(mode);
  controls.showX = mode === TRANSFORM_MODES.TRANSLATE;
  controls.showY = mode === TRANSFORM_MODES.ROTATE;
  controls.showZ = mode === TRANSFORM_MODES.TRANSLATE;
}

function disposeMaterial(material) {
  if (Array.isArray(material)) material.forEach((item) => item.dispose());
  else material.dispose();
}

function replaceFloorGrid(runtime, floorTheme, cellSize) {
  runtime.scene.remove(runtime.grid);
  runtime.grid.geometry.dispose();
  disposeMaterial(runtime.grid.material);
  const divisions = Math.min(240, Math.max(1, Math.round(100 / cellSize)));
  const grid = new THREE.GridHelper(100, divisions, floorTheme.gridCenter, floorTheme.grid);
  grid.position.y = -0.02;
  runtime.grid = grid;
  runtime.scene.add(grid);
}

export default function FloorOverviewScene({
  building,
  floor,
  rooms,
  roomScenes,
  selectedRoomId,
  theme,
  transformMode,
  gridSettings,
  gridScopeId,
  onSelectRoom,
  onUpdateRoom,
  onEnterRoom,
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const gridSettingsRef = useRef(gridSettings);
  const gridScopeIdRef = useRef(gridScopeId);
  const [dragSnapSize, setDragSnapSize] = useState(null);
  const handlersRef = useRef({ onSelectRoom, onUpdateRoom, onEnterRoom });

  useEffect(() => {
    handlersRef.current = { onSelectRoom, onUpdateRoom, onEnterRoom };
  }, [onEnterRoom, onSelectRoom, onUpdateRoom]);

  useEffect(() => {
    gridSettingsRef.current = gridSettings;
    gridScopeIdRef.current = gridScopeId;
  }, [gridScopeId, gridSettings]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const sceneTheme = SCENE_THEMES.dark;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(sceneTheme.background);
    scene.fog = new THREE.Fog(sceneTheme.fog, 65, 150);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Floor와 Room을 편집하는 3D 화면");
    renderer.domElement.setAttribute("role", "application");
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 220);
    camera.position.set(34, 42, 38);
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(0, 0, 0);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.minDistance = 10;
    orbitControls.maxDistance = 130;
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.02;
    orbitControls.update();

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setTranslationSnap(null);
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(5));
    transformControls.showY = false;
    scene.add(transformControls.getHelper());

    const roomRoot = new THREE.Group();
    scene.add(roomRoot);
    const grid = new THREE.GridHelper(100, 100, 0x517483, 0x29434f);
    grid.position.y = -0.02;
    scene.add(grid);
    const boundaryRoot = new THREE.Group();
    scene.add(boundaryRoot);
    const gridRegionRoot = new THREE.Group();
    scene.add(gridRegionRoot);
    const gridSnapMarker = createGridSnapMarker(sceneTheme.selection);
    scene.add(gridSnapMarker);

    const hemisphereLight = new THREE.HemisphereLight(sceneTheme.hemisphereSky, sceneTheme.hemisphereGround, 1.8);
    scene.add(hemisphereLight);
    const keyLight = new THREE.DirectionalLight(sceneTheme.keyLight, 2.1);
    keyLight.position.set(28, 52, 26);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(sceneTheme.fillLight, 0.7);
    fillLight.position.set(-30, 20, -24);
    scene.add(fillLight);

    const runtime = {
      container, scene, renderer, camera, orbitControls, transformControls,
      roomRoot, roomObjects: new Map(), grid, boundaryRoot,
      gridRegionRoot, gridSnapMarker, dragging: false,
      hemisphereLight, keyLight, fillLight,
    };
    runtimeRef.current = runtime;
    const raycaster = new THREE.Raycaster();
    const pointerStart = new THREE.Vector2();

    function handlePointerDown(event) { pointerStart.set(event.clientX, event.clientY); }
    function handlePointerUp(event) {
      if (event.button !== 0 || pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5 || transformControls.axis) return;
      raycaster.setFromCamera(getPointer(event, renderer.domElement), camera);
      const [intersection] = raycaster.intersectObjects(roomRoot.children, true);
      handlersRef.current.onSelectRoom(intersection ? findRoomId(intersection.object, roomRoot) : null);
    }
    function handleDoubleClick(event) {
      raycaster.setFromCamera(getPointer(event, renderer.domElement), camera);
      const [intersection] = raycaster.intersectObjects(roomRoot.children, true);
      const roomId = intersection ? findRoomId(intersection.object, roomRoot) : null;
      if (roomId) handlersRef.current.onEnterRoom(roomId);
    }
    function handleObjectChange() {
      const object = transformControls.object;
      if (!object?.userData.roomId) return;
      if (transformControls.mode === TRANSFORM_MODES.TRANSLATE) {
        const { position, cellSize } = snapHorizontalPosition(object.position, gridSettingsRef.current, gridScopeIdRef.current);
        object.position.x = position.x;
        object.position.z = position.z;
        updateGridSnapMarker(runtime.gridSnapMarker, position, runtime.dragging && cellSize !== null);
        setDragSnapSize((current) => current === cellSize ? current : cellSize);
      }
      handlersRef.current.onUpdateRoom(object.userData.roomId, {
        position: { x: object.position.x, y: 0, z: object.position.z },
        rotation: { x: 0, y: object.rotation.y, z: 0 },
      });
    }
    function handleDraggingChanged(event) {
      orbitControls.enabled = !event.value;
      runtime.dragging = event.value;
      if (!event.value) {
        updateGridSnapMarker(runtime.gridSnapMarker, { x: 0, z: 0 }, false);
        setDragSnapSize(null);
      }
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("dblclick", handleDoubleClick);
    transformControls.addEventListener("objectChange", handleObjectChange);
    transformControls.addEventListener("dragging-changed", handleDraggingChanged);
    const resizeObserver = new ResizeObserver(() => resizeRuntime(runtime));
    resizeObserver.observe(container);
    resizeRuntime(runtime);
    let animationFrameId;
    function renderFrame() {
      orbitControls.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(renderFrame);
    }
    renderFrame();

    return () => {
      runtimeRef.current = null;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      transformControls.removeEventListener("objectChange", handleObjectChange);
      transformControls.removeEventListener("dragging-changed", handleDraggingChanged);
      transformControls.detach();
      transformControls.dispose();
      orbitControls.dispose();
      runtime.roomObjects.forEach(disposeObject3D);
      disposeObject3D(runtime.boundaryRoot);
      disposeObject3D(runtime.gridRegionRoot);
      disposeObject3D(runtime.gridSnapMarker);
      runtime.grid.geometry.dispose();
      disposeMaterial(runtime.grid.material);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const sceneTheme = SCENE_THEMES[theme];
    runtime.scene.background.set(sceneTheme.background);
    runtime.scene.fog.color.set(sceneTheme.fog);
    runtime.hemisphereLight.color.set(sceneTheme.hemisphereSky);
    runtime.hemisphereLight.groundColor.set(sceneTheme.hemisphereGround);
    runtime.keyLight.color.set(sceneTheme.keyLight);
    runtime.fillLight.color.set(sceneTheme.fillLight);
    replaceFloorGrid(runtime, FLOOR_THEMES[theme], gridSettings.baseSize);
  }, [gridSettings.baseSize, theme]);

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
    if (!runtime || !building) return;
    runtime.boundaryRoot.children.forEach(disposeObject3D);
    runtime.boundaryRoot.clear();
    const width = building.parameters.width;
    const depth = building.parameters.depth;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.08, depth),
      new THREE.MeshStandardMaterial({ color: FLOOR_THEMES[theme].boundary, transparent: true, opacity: 0.18 }),
    );
    base.position.y = -0.05;
    runtime.boundaryRoot.add(base);
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(width, 0.12, depth)),
      new THREE.LineBasicMaterial({ color: FLOOR_THEMES[theme].boundary }),
    );
    runtime.boundaryRoot.add(outline);
  }, [building, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const floorTheme = FLOOR_THEMES[theme];
    const expectedIds = new Set(rooms.map((room) => room.id));
    runtime.roomObjects.forEach((object, roomId) => {
      if (!expectedIds.has(roomId)) {
        if (runtime.transformControls.object === object) runtime.transformControls.detach();
        runtime.roomRoot.remove(object);
        disposeObject3D(object);
        runtime.roomObjects.delete(roomId);
      }
    });
    rooms.forEach((room) => {
      const roomScene = getRoomScene(room.id, roomScenes);
      const selected = room.id === selectedRoomId;
      const signature = getRoomLayoutSignature(room, roomScene, selected, theme);
      let object = runtime.roomObjects.get(room.id);
      if (!object || object.userData.geometrySignature !== signature) {
        if (object) {
          if (runtime.transformControls.object === object) runtime.transformControls.detach();
          runtime.roomRoot.remove(object);
          disposeObject3D(object);
        }
        object = createRoomLayoutObject(room, roomScene, {
          selected,
          theme,
          selectionColor: SCENE_THEMES[theme].selection,
          selectionEdge: SCENE_THEMES[theme].worldSelection,
          edgeColor: floorTheme.edge,
          equipmentColor: floorTheme.equipment,
        });
        runtime.roomObjects.set(room.id, object);
        runtime.roomRoot.add(object);
      }
      object.position.set(room.position.x, room.position.y, room.position.z);
      object.rotation.set(room.rotation.x, room.rotation.y, room.rotation.z);
    });
    const selectedObject = runtime.roomObjects.get(selectedRoomId);
    if (selectedObject) runtime.transformControls.attach(selectedObject);
    else runtime.transformControls.detach();
  }, [roomScenes, rooms, selectedRoomId, theme]);

  useEffect(() => {
    const controls = runtimeRef.current?.transformControls;
    if (controls) configureTransformControls(controls, transformMode);
  }, [transformMode]);

  const selectedPosition = rooms.find((room) => room.id === selectedRoomId)?.position;
  const effectiveSnapSize = gridSettings.enabled
    ? dragSnapSize ?? getGridResolutionAtPosition(gridSettings, gridScopeId, selectedPosition)
    : null;

  return (
    <section className={styles.viewport} aria-label="층 편집 화면">
      <div ref={containerRef} className={styles.canvasMount} />
      <div className={styles.sceneStatus}><span /> 층 편집 · 중간 상세</div>
      {effectiveSnapSize !== null && <div className={styles.gridSnapStatus}>그리드 스냅 · {formatGridResolution(effectiveSnapSize)}</div>}
      <div className={styles.floorName}>{building?.name} / {floor?.name}</div>
      <div className={styles.axisLegend} aria-hidden="true"><b>X</b><b>Y</b><b>Z</b><span>미터</span></div>
    </section>
  );
}
