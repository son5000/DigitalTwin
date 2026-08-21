import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { TRANSFORM_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import {
  formatGridResolution,
  getGridRegionsForScope,
  getGridResolutionAtPosition,
  snapHorizontalPosition,
} from "@/features/digitalTwin/editor/constants/gridSettings";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import {
  createSiteObjectFromArea,
  createSitePlacementArea,
  SITE_CREATION_TEMPLATE_MAP,
  SITE_INTERACTION_MODES,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentTemplates";
import {
  createBuildingObject,
  getBuildingFloorCount,
  getBuildingSignature,
  updateBuildingFloorVisualState,
} from "@/features/digitalTwin/editor/world/BuildingFactory";
import {
  createGridRegionGuide,
  createGridSnapMarker,
  updateGridSnapMarker,
} from "@/features/digitalTwin/editor/world/GridGuideFactory";
import {
  createSiteEnvironmentObject,
  getSiteObjectSignature,
} from "@/features/digitalTwin/editor/world/SiteEnvironmentFactory";

import { disposeObject3D } from "./disposeObject3D";
import styles from "./SiteOverviewScene.module.css";

const OVERVIEW_CAMERA = new THREE.Vector3(72, 58, 78);
const OVERVIEW_TARGET = new THREE.Vector3(12, 5, 0);
const SITE_VISUAL_THEMES = {
  light: { grid: 0x9babb6, gridCenter: 0x708691, edge: 0x607987, floor: 0xb8c8d0, apron: 0xcbd5da },
  dark: { grid: 0x2b4652, gridCenter: 0x4f7180, edge: 0x7696a3, floor: 0x42606c, apron: 0x263a43 },
};

function findUserData(object, key, root) {
  let current = object;
  while (current && current !== root) {
    if (current.userData[key]) return current.userData[key];
    current = current.parent;
  }
  return null;
}

function getPointer(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
}

function resizeRuntime(runtime) {
  const { width, height } = runtime.container.getBoundingClientRect();
  if (!width || !height) return;
  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

function configureSiteTransformControls(transformControls, transformMode) {
  transformControls.setMode(transformMode);
  transformControls.showX = transformMode === TRANSFORM_MODES.TRANSLATE;
  transformControls.showY = true;
  transformControls.showZ = transformMode === TRANSFORM_MODES.TRANSLATE;
}

function disposeGrid(grid) {
  grid.geometry.dispose();
  if (Array.isArray(grid.material)) grid.material.forEach((material) => material.dispose());
  else grid.material.dispose();
}

function replaceSiteGrid(runtime, siteTheme, cellSize) {
  runtime.scene.remove(runtime.grid);
  disposeGrid(runtime.grid);
  const divisions = Math.min(240, Math.max(1, Math.round(220 / cellSize)));
  runtime.grid = new THREE.GridHelper(220, divisions, siteTheme.gridCenter, siteTheme.grid);
  runtime.grid.position.y = -0.01;
  runtime.scene.add(runtime.grid);
}

function snapAreaPoint(point, settings, scopeId) {
  const cellSize = getGridResolutionAtPosition(settings, scopeId, point);
  return {
    x: Number((Math.round(point.x / cellSize) * cellSize).toFixed(6)),
    z: Number((Math.round(point.z / cellSize) * cellSize).toFixed(6)),
    cellSize,
  };
}

function createArea(start, end) {
  return {
    center: { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 },
    width: Math.max(start.cellSize, Math.abs(end.x - start.x)),
    depth: Math.max(start.cellSize, Math.abs(end.z - start.z)),
    cellSize: Math.min(start.cellSize, end.cellSize),
  };
}

function updateAreaGuide(guide, area, visible = true) {
  if (!guide) return;
  guide.visible = visible && Boolean(area);
  if (!area) return;
  guide.position.set(area.center.x, 0.035, area.center.z);
  guide.scale.set(area.width, 1, area.depth);
}

function makePlacementPreviewTransparent(root) {
  root.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = child.isLine ? 0.8 : 0.42;
      material.depthWrite = false;
      if (material.emissive) material.emissiveIntensity = 0.18;
    });
  });
}

function createPlacementPreview(templateId, theme) {
  const template = SITE_CREATION_TEMPLATE_MAP[templateId];
  const area = createSitePlacementArea(templateId, { x: 0, z: 0 });
  if (!template || !area) return null;

  if (template.createsBuilding) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: SCENE_THEMES[theme].selection,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      roughness: 0.74,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(area.width, 4, area.depth), material);
    mesh.position.y = 2;
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: SCENE_THEMES[theme].selection, transparent: true, opacity: 0.92 }),
    ));
    group.add(mesh);
    return group;
  }

  const definition = createSiteObjectFromArea(templateId, area, 1);
  if (!definition) return null;
  const preview = createSiteEnvironmentObject(definition, {
    selected: true,
    theme,
    selectionColor: SCENE_THEMES[theme].selection,
    edgeColor: SITE_VISUAL_THEMES[theme].edge,
  });
  makePlacementPreviewTransparent(preview);
  return preview;
}

export default function SiteOverviewScene({
  buildings,
  floors,
  siteObjects,
  selectedBuildingId,
  selectedSiteObjectId,
  selectedFloorId,
  focusedBuildingId,
  focusRequestKey,
  interactionMode,
  placementTemplateId,
  areaSelection,
  theme,
  transformMode,
  gridSettings,
  gridScopeId,
  onSelectBuilding,
  onSelectSiteObject,
  onUpdateBuilding,
  onUpdateSiteObject,
  onEnterBuilding,
  onSelectFloor,
  onEnterFloor,
  onAreaSelectionChange,
  onPlaceTemplate,
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const gridSettingsRef = useRef(gridSettings);
  const gridScopeIdRef = useRef(gridScopeId);
  const interactionModeRef = useRef(interactionMode);
  const placementTemplateIdRef = useRef(placementTemplateId);
  const [dragSnapSize, setDragSnapSize] = useState(null);
  const [liveArea, setLiveArea] = useState(null);
  const handlersRef = useRef({});

  useEffect(() => {
    handlersRef.current = {
      onSelectBuilding, onSelectSiteObject, onUpdateBuilding, onUpdateSiteObject,
      onEnterBuilding, onSelectFloor, onEnterFloor, onAreaSelectionChange, onPlaceTemplate,
    };
  }, [onAreaSelectionChange, onEnterBuilding, onEnterFloor, onPlaceTemplate, onSelectBuilding, onSelectFloor, onSelectSiteObject, onUpdateBuilding, onUpdateSiteObject]);

  useEffect(() => {
    gridSettingsRef.current = gridSettings;
    gridScopeIdRef.current = gridScopeId;
    interactionModeRef.current = interactionMode;
    placementTemplateIdRef.current = placementTemplateId;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.renderer.domElement.style.cursor = interactionMode === SITE_INTERACTION_MODES.NAVIGATE ? "grab" : "crosshair";
    runtime.areaStart = null;
    runtime.placementPointerDown = false;
    runtime.orbitControls.enabled = !runtime.dragging;
    if (runtime.placementPreview && interactionMode !== SITE_INTERACTION_MODES.PLACE_OBJECT) {
      runtime.placementPreview.visible = false;
    }
    if (interactionMode !== SITE_INTERACTION_MODES.PLACE_OBJECT) {
      updateGridSnapMarker(runtime.gridSnapMarker, { x: 0, z: 0 }, false);
    }
  }, [gridScopeId, gridSettings, interactionMode, placementTemplateId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const sceneTheme = SCENE_THEMES.dark;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(sceneTheme.background);
    scene.fog = new THREE.Fog(sceneTheme.fog, 90, 240);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "공장 부지와 건물을 편집하는 3D 화면");
    renderer.domElement.setAttribute("role", "application");
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
    camera.position.copy(OVERVIEW_CAMERA);
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.copy(OVERVIEW_TARGET);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.minDistance = 8;
    orbitControls.maxDistance = 260;
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.015;
    orbitControls.update();

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode(TRANSFORM_MODES.TRANSLATE);
    transformControls.setTranslationSnap(null);
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
    scene.add(transformControls.getHelper());
    const objectRoot = new THREE.Group();
    objectRoot.name = "부지 오브젝트";
    scene.add(objectRoot);
    const grid = new THREE.GridHelper(220, 110, 0x4f7180, 0x2b4652);
    grid.position.y = -0.01;
    scene.add(grid);
    const gridRegionRoot = new THREE.Group();
    scene.add(gridRegionRoot);
    const gridSnapMarker = createGridSnapMarker(sceneTheme.selection);
    scene.add(gridSnapMarker);

    const groundPicker = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    groundPicker.rotation.x = -Math.PI / 2;
    groundPicker.position.y = 0.001;
    scene.add(groundPicker);
    const areaGuide = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.035, 1),
      new THREE.MeshBasicMaterial({ color: sceneTheme.selection, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    areaGuide.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(areaGuide.geometry),
      new THREE.LineBasicMaterial({ color: sceneTheme.selection, transparent: true, opacity: 0.95 }),
    ));
    areaGuide.visible = false;
    scene.add(areaGuide);

    const hemisphereLight = new THREE.HemisphereLight(sceneTheme.hemisphereSky, sceneTheme.hemisphereGround, 1.8);
    const keyLight = new THREE.DirectionalLight(sceneTheme.keyLight, 2.4);
    keyLight.position.set(40, 70, 35);
    const fillLight = new THREE.DirectionalLight(sceneTheme.fillLight, 0.8);
    fillLight.position.set(-45, 28, -36);
    scene.add(hemisphereLight, keyLight, fillLight);

    const runtime = {
      container, scene, renderer, camera, orbitControls, transformControls, objectRoot,
      buildingObjects: new Map(), siteEnvironmentObjects: new Map(), grid, gridRegionRoot,
      gridSnapMarker, groundPicker, areaGuide, hemisphereLight, keyLight, fillLight,
      dragging: false, areaStart: null, placementPointerDown: false, placementPreview: null,
      cameraDestination: null, targetDestination: null,
    };
    runtimeRef.current = runtime;

    const raycaster = new THREE.Raycaster();
    const pointerStart = new THREE.Vector2();
    const hitGround = (event) => {
      raycaster.setFromCamera(getPointer(event, renderer.domElement), camera);
      return raycaster.intersectObject(groundPicker, false)[0]?.point ?? null;
    };
    function handlePointerDown(event) {
      pointerStart.set(event.clientX, event.clientY);
      if (event.button !== 0 || transformControls.axis) return;
      if (
        interactionModeRef.current === SITE_INTERACTION_MODES.PLACE_OBJECT
        && placementTemplateIdRef.current
      ) {
        runtime.placementPointerDown = true;
        runtime.orbitControls.enabled = false;
        renderer.domElement.setPointerCapture?.(event.pointerId);
        return;
      }
      if (interactionModeRef.current !== SITE_INTERACTION_MODES.AREA_SELECT) return;
      const point = hitGround(event);
      if (!point) return;
      runtime.areaStart = snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current);
      runtime.orbitControls.enabled = false;
      const area = createArea(runtime.areaStart, runtime.areaStart);
      updateAreaGuide(runtime.areaGuide, area);
      setLiveArea(area);
      renderer.domElement.setPointerCapture?.(event.pointerId);
    }
    function handlePointerMove(event) {
      if (runtime.areaStart) {
        const point = hitGround(event);
        if (!point) return;
        const area = createArea(runtime.areaStart, snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current));
        updateAreaGuide(runtime.areaGuide, area);
        setLiveArea(area);
        return;
      }
      if (
        interactionModeRef.current !== SITE_INTERACTION_MODES.PLACE_OBJECT
        || !placementTemplateIdRef.current
        || !runtime.placementPreview
      ) return;
      const point = hitGround(event);
      if (!point) {
        runtime.placementPreview.visible = false;
        return;
      }
      const snappedPoint = snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current);
      runtime.placementPreview.position.set(snappedPoint.x, 0.04, snappedPoint.z);
      runtime.placementPreview.visible = true;
      updateGridSnapMarker(runtime.gridSnapMarker, snappedPoint, true);
      setDragSnapSize((current) => current === snappedPoint.cellSize ? current : snappedPoint.cellSize);
    }
    function handlePointerUp(event) {
      if (event.button !== 0) return;
      if (runtime.areaStart) {
        const point = hitGround(event);
        const end = point ? snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current) : runtime.areaStart;
        const area = createArea(runtime.areaStart, end);
        runtime.areaStart = null;
        runtime.orbitControls.enabled = true;
        setLiveArea(null);
        handlersRef.current.onAreaSelectionChange(area);
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        return;
      }
      if (runtime.placementPointerDown) {
        runtime.placementPointerDown = false;
        runtime.orbitControls.enabled = true;
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        if (pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;
        const point = hitGround(event);
        if (!point || !placementTemplateIdRef.current) return;
        const snappedPoint = snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current);
        const area = createSitePlacementArea(
          placementTemplateIdRef.current,
          snappedPoint,
          snappedPoint.cellSize,
        );
        handlersRef.current.onPlaceTemplate(placementTemplateIdRef.current, area);
        return;
      }
      if (pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5 || transformControls.axis) return;
      raycaster.setFromCamera(getPointer(event, renderer.domElement), camera);
      const intersections = raycaster.intersectObjects(objectRoot.children, true);
      const intersection = intersections[0];
      const floorIntersection = intersections.find((item) => findUserData(item.object, "floorId", objectRoot));
      const floorId = floorIntersection ? findUserData(floorIntersection.object, "floorId", objectRoot) : null;
      if (floorId) return handlersRef.current.onSelectFloor(floorId);
      const buildingId = intersection ? findUserData(intersection.object, "buildingId", objectRoot) : null;
      const siteObjectId = intersection ? findUserData(intersection.object, "siteObjectId", objectRoot) : null;
      if (siteObjectId) handlersRef.current.onSelectSiteObject(siteObjectId);
      else handlersRef.current.onSelectBuilding(buildingId);
    }
    function handleDoubleClick(event) {
      if (interactionModeRef.current !== SITE_INTERACTION_MODES.NAVIGATE) return;
      raycaster.setFromCamera(getPointer(event, renderer.domElement), camera);
      const intersections = raycaster.intersectObjects([...runtime.buildingObjects.values()], true);
      const floorIntersection = intersections.find((item) => findUserData(item.object, "floorId", objectRoot));
      const floorId = floorIntersection ? findUserData(floorIntersection.object, "floorId", objectRoot) : null;
      if (floorId) return handlersRef.current.onEnterFloor(floorId);
      const [intersection] = intersections;
      const buildingId = intersection ? findUserData(intersection.object, "buildingId", objectRoot) : null;
      if (buildingId) handlersRef.current.onEnterBuilding(buildingId);
    }
    function handleObjectChange() {
      const object = transformControls.object;
      if (!object) return;
      if (transformControls.mode === TRANSFORM_MODES.TRANSLATE) {
        const { position, cellSize } = snapHorizontalPosition(object.position, gridSettingsRef.current, gridScopeIdRef.current);
        object.position.x = position.x;
        object.position.z = position.z;
        updateGridSnapMarker(runtime.gridSnapMarker, position, runtime.dragging && cellSize !== null);
        setDragSnapSize((current) => current === cellSize ? current : cellSize);
      }
      const changes = {
        position: { x: object.position.x, y: object.position.y, z: object.position.z },
        rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
      };
      if (object.userData.buildingId) handlersRef.current.onUpdateBuilding(object.userData.buildingId, changes);
      if (object.userData.siteObjectId) handlersRef.current.onUpdateSiteObject(object.userData.siteObjectId, changes);
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
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("dblclick", handleDoubleClick);
    transformControls.addEventListener("objectChange", handleObjectChange);
    transformControls.addEventListener("dragging-changed", handleDraggingChanged);
    const resizeObserver = new ResizeObserver(() => resizeRuntime(runtime));
    resizeObserver.observe(container);
    resizeRuntime(runtime);

    let animationFrameId;
    function renderFrame() {
      if (runtime.cameraDestination && runtime.targetDestination) {
        camera.position.lerp(runtime.cameraDestination, 0.075);
        orbitControls.target.lerp(runtime.targetDestination, 0.075);
        if (camera.position.distanceTo(runtime.cameraDestination) < 0.08) {
          runtime.cameraDestination = null;
          runtime.targetDestination = null;
        }
      }
      runtime.buildingObjects.forEach((buildingObject) => {
        buildingObject.traverse((child) => {
          if (!child.userData.floorId || typeof child.userData.targetY !== "number") return;
          child.position.y = THREE.MathUtils.lerp(child.position.y, child.userData.targetY, 0.09);
          if (typeof child.userData.targetOpacity === "number") {
            child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, child.userData.targetOpacity, 0.09);
          }
        });
      });
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
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      transformControls.removeEventListener("objectChange", handleObjectChange);
      transformControls.removeEventListener("dragging-changed", handleDraggingChanged);
      transformControls.detach();
      transformControls.dispose();
      orbitControls.dispose();
      runtime.buildingObjects.forEach(disposeObject3D);
      runtime.siteEnvironmentObjects.forEach(disposeObject3D);
      if (runtime.placementPreview) disposeObject3D(runtime.placementPreview);
      disposeObject3D(runtime.gridRegionRoot);
      disposeObject3D(runtime.gridSnapMarker);
      disposeObject3D(runtime.areaGuide);
      groundPicker.geometry.dispose();
      groundPicker.material.dispose();
      disposeGrid(runtime.grid);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const sceneTheme = SCENE_THEMES[theme];
    const siteTheme = SITE_VISUAL_THEMES[theme];
    runtime.scene.background.set(sceneTheme.background);
    runtime.scene.fog.color.set(sceneTheme.fog);
    runtime.hemisphereLight.color.set(sceneTheme.hemisphereSky);
    runtime.hemisphereLight.groundColor.set(sceneTheme.hemisphereGround);
    runtime.keyLight.color.set(sceneTheme.keyLight);
    runtime.fillLight.color.set(sceneTheme.fillLight);
    runtime.areaGuide.material.color.set(sceneTheme.selection);
    runtime.areaGuide.children[0].material.color.set(sceneTheme.selection);
    replaceSiteGrid(runtime, siteTheme, gridSettings.baseSize);
  }, [gridSettings.baseSize, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return undefined;
    if (runtime.placementPreview) {
      runtime.scene.remove(runtime.placementPreview);
      disposeObject3D(runtime.placementPreview);
      runtime.placementPreview = null;
    }
    if (!placementTemplateId || interactionMode !== SITE_INTERACTION_MODES.PLACE_OBJECT) return undefined;
    const preview = createPlacementPreview(placementTemplateId, theme);
    if (!preview) return undefined;
    preview.visible = false;
    runtime.placementPreview = preview;
    runtime.scene.add(preview);

    return () => {
      const activeRuntime = runtimeRef.current;
      if (!activeRuntime || activeRuntime.placementPreview !== preview) return;
      activeRuntime.scene.remove(preview);
      disposeObject3D(preview);
      activeRuntime.placementPreview = null;
    };
  }, [interactionMode, placementTemplateId, theme]);

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
    const siteTheme = SITE_VISUAL_THEMES[theme];
    const buildingIds = new Set(buildings.map((building) => building.id));
    runtime.buildingObjects.forEach((object, id) => {
      if (!buildingIds.has(id)) {
        if (runtime.transformControls.object === object) runtime.transformControls.detach();
        runtime.objectRoot.remove(object);
        disposeObject3D(object);
        runtime.buildingObjects.delete(id);
      }
    });
    buildings.forEach((building) => {
      const floorCount = getBuildingFloorCount(building.id, floors);
      const selected = building.id === selectedBuildingId;
      const expanded = building.id === focusedBuildingId;
      const signature = getBuildingSignature(building, floorCount, selected, expanded, theme);
      let object = runtime.buildingObjects.get(building.id);
      if (!object || object.userData.geometrySignature !== signature) {
        if (object) {
          if (runtime.transformControls.object === object) runtime.transformControls.detach();
          runtime.objectRoot.remove(object);
          disposeObject3D(object);
        }
        object = createBuildingObject(building, floors, {
          selected, expanded, selectedFloorId, theme, edgeColor: siteTheme.edge, floorColor: siteTheme.floor,
          apronColor: siteTheme.apron, selectionColor: SCENE_THEMES[theme].selection,
        });
        runtime.buildingObjects.set(building.id, object);
        runtime.objectRoot.add(object);
      }
      object.position.set(building.position.x, building.position.y, building.position.z);
      object.rotation.set(building.rotation.x, building.rotation.y, building.rotation.z);
      if (expanded) {
        updateBuildingFloorVisualState(object, building, floors, {
          selectedFloorId,
          floorColor: siteTheme.floor,
          selectionColor: SCENE_THEMES[theme].selection,
        });
      }
    });

    const siteObjectIds = new Set(siteObjects.map((object) => object.id));
    runtime.siteEnvironmentObjects.forEach((object, id) => {
      if (!siteObjectIds.has(id)) {
        if (runtime.transformControls.object === object) runtime.transformControls.detach();
        runtime.objectRoot.remove(object);
        disposeObject3D(object);
        runtime.siteEnvironmentObjects.delete(id);
      }
    });
    siteObjects.forEach((siteObject) => {
      const selected = siteObject.id === selectedSiteObjectId;
      const signature = getSiteObjectSignature(siteObject, selected, theme);
      let object = runtime.siteEnvironmentObjects.get(siteObject.id);
      if (!object || object.userData.geometrySignature !== signature) {
        if (object) {
          if (runtime.transformControls.object === object) runtime.transformControls.detach();
          runtime.objectRoot.remove(object);
          disposeObject3D(object);
        }
        object = createSiteEnvironmentObject(siteObject, {
          selected, theme, selectionColor: SCENE_THEMES[theme].selection, edgeColor: siteTheme.edge,
        });
        runtime.siteEnvironmentObjects.set(siteObject.id, object);
        runtime.objectRoot.add(object);
      }
      object.position.set(siteObject.position.x, siteObject.position.y, siteObject.position.z);
      object.rotation.set(siteObject.rotation.x, siteObject.rotation.y, siteObject.rotation.z);
    });

    const selectedObject = runtime.buildingObjects.get(selectedBuildingId)
      ?? runtime.siteEnvironmentObjects.get(selectedSiteObjectId);
    if (selectedObject && interactionMode === SITE_INTERACTION_MODES.NAVIGATE) runtime.transformControls.attach(selectedObject);
    else runtime.transformControls.detach();
  }, [buildings, floors, focusedBuildingId, interactionMode, selectedBuildingId, selectedFloorId, selectedSiteObjectId, siteObjects, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const building = buildings.find((item) => item.id === focusedBuildingId);
    if (!building) {
      runtime.cameraDestination = OVERVIEW_CAMERA.clone();
      runtime.targetDestination = OVERVIEW_TARGET.clone();
      return;
    }
    const totalHeight = getBuildingFloorCount(building.id, floors) * building.parameters.floorHeight;
    const radius = Math.max(building.parameters.width, building.parameters.depth, totalHeight);
    const selectedFloor = floors.find((floor) => floor.id === selectedFloorId && floor.parentId === building.id);
    const focusHeight = selectedFloor
      ? building.position.y + (selectedFloor.elevation ?? 0) + building.parameters.floorHeight * 0.35
      : building.position.y + totalHeight * 0.42;
    runtime.targetDestination = new THREE.Vector3(building.position.x, focusHeight, building.position.z);
    runtime.cameraDestination = new THREE.Vector3(
      building.position.x + radius * 1.05,
      focusHeight + Math.max(building.parameters.floorHeight * 2.2, radius * 0.62),
      building.position.z + radius * 1.1,
    );
  }, [buildings, floors, focusedBuildingId, focusRequestKey, selectedFloorId]);

  useEffect(() => {
    updateAreaGuide(runtimeRef.current?.areaGuide, liveArea ?? areaSelection, Boolean(liveArea ?? areaSelection));
  }, [areaSelection, liveArea]);

  useEffect(() => {
    const transformControls = runtimeRef.current?.transformControls;
    if (transformControls) configureSiteTransformControls(transformControls, transformMode);
  }, [transformMode]);

  const selectedPosition = buildings.find((building) => building.id === selectedBuildingId)?.position
    ?? siteObjects.find((object) => object.id === selectedSiteObjectId)?.position;
  const effectiveSnapSize = gridSettings.enabled
    ? dragSnapSize ?? getGridResolutionAtPosition(gridSettings, gridScopeId, selectedPosition)
    : null;
  const displayedArea = liveArea ?? areaSelection;

  return (
    <section className={styles.viewport} aria-label="부지 3D 편집 화면">
      <div ref={containerRef} className={styles.canvasMount} />
      <div className={styles.sceneStatus}><span /> 부지 편집 · 저상세</div>
      {effectiveSnapSize !== null && <div className={styles.gridSnapStatus}>그리드 스냅 · {formatGridResolution(effectiveSnapSize)}</div>}
      {displayedArea && <div className={styles.areaStatus}>{displayedArea.width.toFixed(1)} × {displayedArea.depth.toFixed(1)} m</div>}
      <div className={styles.hint}>{interactionMode === SITE_INTERACTION_MODES.AREA_SELECT
        ? "그리드 위를 드래그해 영역 선택"
        : interactionMode === SITE_INTERACTION_MODES.PLACE_OBJECT
          ? "미리보기를 움직이고 그리드를 클릭해 배치 · Esc로 종료"
          : "드래그로 월드 이동/회전 · 클릭은 선택 · 더블 클릭은 내부로 이동"}</div>
      <div className={styles.axisLegend} aria-hidden="true"><b>X</b><b>Y</b><b>Z</b><span>미터</span></div>
    </section>
  );
}
