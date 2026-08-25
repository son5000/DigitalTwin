import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { ResetIcon } from "@/components/icons";
import { VIEW_MODES } from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import {
  DEFAULT_GRID_SETTINGS,
  formatGridResolution,
  getGridRegionsForScope,
  getGridResolutionAtPosition,
  snapHorizontalPosition,
} from "@/features/digitalTwin/editor/constants/gridSettings";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { OBJECT_LIBRARY_DRAG_TYPE } from "@/features/digitalTwin/editor/constants/objectLibraryCatalog";
import {
  DEFAULT_SITE_ENVIRONMENT,
  getSiteBounds,
  SITE_BACKGROUND_PRESETS,
  SITE_GROUND_MATERIAL_OPTIONS,
} from "@/features/digitalTwin/editor/constants/siteEnvironmentSettings";
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
import { placeObjectsInArea } from "@/features/digitalTwin/editor/utils/siteAreaPlacement";

import {
  bindCameraFocusCancellation,
  cancelCameraFocus,
  focusCameraOnObject,
  focusCameraOnObjectFront,
  updateCameraFocus,
} from "./cameraFocus";
import { disposeObject3D } from "./disposeObject3D";
import { makePlacementPreviewTransparent } from "./placementPreview";
import {
  attachDualTransformControls,
  configureDualTransformControls,
  createDualTransformControls,
  detachDualTransformControls,
  disposeDualTransformControls,
  dualTransformIsActive,
  setDualTransformDragging,
} from "./dualTransformControls";
import styles from "./SiteOverviewScene.module.css";

const OVERVIEW_CAMERA = new THREE.Vector3(72, 58, 78);
const OVERVIEW_TARGET = new THREE.Vector3(12, 5, 0);
const MAX_SITE_GRID_LINES_PER_AXIS = 800;
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
  const aspect = width / height;
  runtime.perspectiveCamera.aspect = aspect;
  runtime.perspectiveCamera.updateProjectionMatrix();
  const halfHeight = runtime.orthographicSize / 2;
  runtime.orthographicCamera.left = -halfHeight * aspect;
  runtime.orthographicCamera.right = halfHeight * aspect;
  runtime.orthographicCamera.top = halfHeight;
  runtime.orthographicCamera.bottom = -halfHeight;
  runtime.orthographicCamera.updateProjectionMatrix();
}

function createSiteGridLines(width, depth, cellSize, color) {
  const points = [];
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const longestCellCount = Math.max(width, depth) / Math.max(cellSize, 0.001);
  const displayStep = cellSize * Math.max(1, Math.ceil(longestCellCount / MAX_SITE_GRID_LINES_PER_AXIS));
  const firstX = Math.ceil((-halfWidth + 1e-8) / displayStep) * displayStep;
  const firstZ = Math.ceil((-halfDepth + 1e-8) / displayStep) * displayStep;

  for (let x = firstX; x < halfWidth - 1e-8; x += displayStep) {
    if (Math.abs(x) < 1e-8) continue;
    points.push(new THREE.Vector3(x, 0, -halfDepth), new THREE.Vector3(x, 0, halfDepth));
  }
  for (let z = firstZ; z < halfDepth - 1e-8; z += displayStep) {
    if (Math.abs(z) < 1e-8) continue;
    points.push(new THREE.Vector3(-halfWidth, 0, z), new THREE.Vector3(halfWidth, 0, z));
  }

  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 }),
  );
}

function captureCameraState(runtime) {
  const capture = (camera) => ({
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    up: camera.up.clone(),
    near: camera.near,
    far: camera.far,
    zoom: camera.zoom,
    fov: camera.fov,
  });
  return {
    activeCamera: runtime.activeCamera.isOrthographicCamera ? "orthographic" : "perspective",
    perspective: capture(runtime.perspectiveCamera),
    orthographic: capture(runtime.orthographicCamera),
    target: runtime.orbitControls.target.clone(),
  };
}

function restoreCameraState(runtime, snapshot) {
  if (!snapshot) return;
  const restore = (camera, state) => {
    if (!state) return;
    camera.position.copy(state.position);
    camera.quaternion.copy(state.quaternion);
    camera.up.copy(state.up);
    camera.near = state.near;
    camera.far = state.far;
    if (camera.isPerspectiveCamera && typeof state.fov === "number") camera.fov = state.fov;
    if (camera.isOrthographicCamera && typeof state.zoom === "number") camera.zoom = state.zoom;
    camera.updateProjectionMatrix();
  };
  restore(runtime.perspectiveCamera, snapshot.perspective);
  restore(runtime.orthographicCamera, snapshot.orthographic);
  runtime.activeCamera = snapshot.activeCamera === "orthographic"
    ? runtime.orthographicCamera
    : runtime.perspectiveCamera;
  runtime.orbitControls.object = runtime.activeCamera;
  configureDualTransformControls(runtime.transformControls, runtime.transformTools, {
    camera: runtime.activeCamera,
    allowVerticalTranslation: runtime.activeCamera.isPerspectiveCamera,
  });
  runtime.orbitControls.target.copy(snapshot.target);
  cancelCameraFocus(runtime);
  resizeRuntime(runtime);
  runtime.orbitControls.update();
}

function beginBuildingFocusMode(runtime, cameraStateRef) {
  if (runtime.buildingFocusMode) return;
  const cameraSnapshot = cameraStateRef?.current ?? captureCameraState(runtime);
  runtime.buildingFocusMode = {
    cameraSnapshot,
    buildingVisibility: new Map([...runtime.buildingObjects].map(([id, object]) => [id, object.visible])),
    siteObjectVisibility: new Map([...runtime.siteEnvironmentObjects].map(([id, object]) => [id, object.visible])),
  };
  if (cameraStateRef) cameraStateRef.current = cameraSnapshot;
}

function applyBuildingFocusVisibility(runtime, selectedBuildingId) {
  const state = runtime.buildingFocusMode;
  if (!state) return;
  runtime.buildingObjects.forEach((object, id) => {
    if (!state.buildingVisibility.has(id)) state.buildingVisibility.set(id, object.visible);
    object.visible = id === selectedBuildingId;
  });
  runtime.siteEnvironmentObjects.forEach((object, id) => {
    if (!state.siteObjectVisibility.has(id)) state.siteObjectVisibility.set(id, object.visible);
    object.visible = false;
  });
}

function restoreBuildingFocusVisibility(runtime) {
  const state = runtime.buildingFocusMode;
  if (!state) return;
  runtime.buildingObjects.forEach((object, id) => {
    object.visible = state.buildingVisibility.get(id) ?? object.visible;
  });
  runtime.siteEnvironmentObjects.forEach((object, id) => {
    object.visible = state.siteObjectVisibility.get(id) ?? object.visible;
  });
  runtime.buildingFocusMode = null;
}

function measureCameraSafeInsets(runtime) {
  const canvasBounds = runtime.renderer.domElement.getBoundingClientRect();
  const sceneArea = runtime.container.closest("[data-scene-area]");
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!sceneArea) return insets;
  const overlayRoot = sceneArea.parentElement ?? sceneArea;
  const candidates = overlayRoot.querySelectorAll([
    "[data-camera-safe-ui]",
    "[data-camera-obstacle-ui]",
    "[aria-label$='편집 도구']",
    "[aria-label='월드 보기 방식']",
    "[aria-label='카메라 초기화']",
  ].join(","));
  candidates.forEach((element) => {
    const bounds = element.getBoundingClientRect();
    const overlaps = bounds.right > canvasBounds.left
      && bounds.left < canvasBounds.right
      && bounds.bottom > canvasBounds.top
      && bounds.top < canvasBounds.bottom;
    if (!overlaps || !bounds.width || !bounds.height) return;
    const distances = {
      top: Math.abs(bounds.top - canvasBounds.top),
      right: Math.abs(canvasBounds.right - bounds.right),
      bottom: Math.abs(canvasBounds.bottom - bounds.bottom),
      left: Math.abs(bounds.left - canvasBounds.left),
    };
    const edge = Object.entries(distances).sort((left, right) => left[1] - right[1])[0][0];
    if (edge === "top") insets.top = Math.max(insets.top, bounds.bottom - canvasBounds.top + 12);
    if (edge === "right") insets.right = Math.max(insets.right, canvasBounds.right - bounds.left + 12);
    if (edge === "bottom") insets.bottom = Math.max(insets.bottom, canvasBounds.bottom - bounds.top + 12);
    if (edge === "left") insets.left = Math.max(insets.left, bounds.right - canvasBounds.left + 12);
  });
  return insets;
}

function createSiteGrid(width, depth, cellSize, siteTheme) {
  const group = new THREE.Group();
  group.name = "SiteGrid";
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const centerLines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfWidth, 0, 0), new THREE.Vector3(halfWidth, 0, 0),
      new THREE.Vector3(0, 0, -halfDepth), new THREE.Vector3(0, 0, halfDepth),
    ]),
    new THREE.LineBasicMaterial({ color: siteTheme.gridCenter, transparent: true, opacity: 0.92 }),
  );
  const boundary = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfWidth, 0, -halfDepth),
      new THREE.Vector3(halfWidth, 0, -halfDepth),
      new THREE.Vector3(halfWidth, 0, halfDepth),
      new THREE.Vector3(-halfWidth, 0, halfDepth),
      new THREE.Vector3(-halfWidth, 0, -halfDepth),
    ]),
    new THREE.LineBasicMaterial({ color: siteTheme.edge, transparent: true, opacity: 0.98 }),
  );
  group.add(createSiteGridLines(width, depth, cellSize, siteTheme.grid), centerLines, boundary);
  group.position.y = -0.01;
  return group;
}

function replaceSiteGrid(runtime, siteTheme, cellSize, width, depth) {
  runtime.scene.remove(runtime.grid);
  disposeObject3D(runtime.grid);
  runtime.grid = createSiteGrid(width, depth, cellSize, siteTheme);
  runtime.scene.add(runtime.grid);
}

function snapAreaPoint(point, settings, scopeId, bounds) {
  const cellSize = getGridResolutionAtPosition(settings, scopeId, point);
  return {
    x: Number(THREE.MathUtils.clamp(Math.round(point.x / cellSize) * cellSize, bounds.minX, bounds.maxX).toFixed(6)),
    z: Number(THREE.MathUtils.clamp(Math.round(point.z / cellSize) * cellSize, bounds.minZ, bounds.maxZ).toFixed(6)),
    cellSize,
  };
}

function createArea(start, end, bounds) {
  const cellSize = Math.min(start.cellSize, end.cellSize);
  const rawWidth = Math.abs(end.x - start.x);
  const rawDepth = Math.abs(end.z - start.z);
  const width = Math.min(bounds.width, Math.max(cellSize, rawWidth));
  const depth = Math.min(bounds.depth, Math.max(cellSize, rawDepth));
  const centerX = THREE.MathUtils.clamp((start.x + end.x) / 2, bounds.minX + width / 2, bounds.maxX - width / 2);
  const centerZ = THREE.MathUtils.clamp((start.z + end.z) / 2, bounds.minZ + depth / 2, bounds.maxZ - depth / 2);
  return {
    center: { x: centerX, z: centerZ },
    width,
    depth,
    cellSize,
  };
}

function clampObjectToSiteBounds(object, bounds) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const targetX = size.x > bounds.width
    ? 0
    : THREE.MathUtils.clamp(center.x, bounds.minX + size.x / 2, bounds.maxX - size.x / 2);
  const targetZ = size.z > bounds.depth
    ? 0
    : THREE.MathUtils.clamp(center.z, bounds.minZ + size.z / 2, bounds.maxZ - size.z / 2);
  object.position.x += targetX - center.x;
  object.position.z += targetZ - center.z;
  object.updateWorldMatrix(true, true);
}

function clampCameraTargetToSite(runtime) {
  const { target } = runtime.orbitControls;
  const bounds = runtime.siteBounds;
  if (!bounds) return;
  const x = THREE.MathUtils.clamp(target.x, bounds.minX, bounds.maxX);
  const z = THREE.MathUtils.clamp(target.z, bounds.minZ, bounds.maxZ);
  if (x === target.x && z === target.z) return;
  runtime.activeCamera.position.x += x - target.x;
  runtime.activeCamera.position.z += z - target.z;
  target.x = x;
  target.z = z;
}

function clipGridRegionToSite(region, bounds) {
  const minX = Math.max(bounds.minX, region.center.x - region.size.width / 2);
  const maxX = Math.min(bounds.maxX, region.center.x + region.size.width / 2);
  const minZ = Math.max(bounds.minZ, region.center.z - region.size.depth / 2);
  const maxZ = Math.min(bounds.maxZ, region.center.z + region.size.depth / 2);
  if (minX >= maxX || minZ >= maxZ) return null;
  return {
    ...region,
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    size: { width: maxX - minX, depth: maxZ - minZ },
  };
}

function updateAreaGuide(guide, area, visible = true) {
  if (!guide) return;
  guide.visible = visible && Boolean(area);
  if (!area) return;
  guide.position.set(area.center.x, 0.035, area.center.z);
  guide.scale.set(area.width, 1, area.depth);
}

function createPlacementPreview(templateId, variants, theme) {
  const template = SITE_CREATION_TEMPLATE_MAP[templateId];
  const area = createSitePlacementArea(templateId, { x: 0, z: 0 });
  if (!template || !area) return null;

  if (template.createsBuilding) {
    const floorCount = Math.max(1, template.parameters?.floorCount ?? 1);
    const building = {
      id: "PLACEMENT_PREVIEW",
      name: template.name,
      templateId: template.id,
      objectDefinitionId: template.id,
      variants: { ...template.defaultVariants, ...variants },
      parameters: {
        ...template.parameters,
        width: area.width,
        depth: area.depth,
        roofType: variants?.roofStyle ?? template.defaultVariants?.roofStyle ?? "FLAT",
      },
      appearance: { color: template.color, material: template.material },
    };
    const floors = Array.from({ length: floorCount }, (_, index) => ({
      id: `PREVIEW_FLOOR_${index}`,
      parentId: building.id,
      level: index + 1,
    }));
    const preview = createBuildingObject(building, floors, {
      selected: true,
      expanded: false,
      selectedFloorId: null,
      theme,
      edgeColor: SITE_VISUAL_THEMES[theme].edge,
      floorColor: SITE_VISUAL_THEMES[theme].floor,
      apronColor: SITE_VISUAL_THEMES[theme].apron,
      selectionColor: SCENE_THEMES[theme].selection,
    });
    makePlacementPreviewTransparent(preview);
    return preview;
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

function clearPlacementGhosts(root) {
  if (!root) return;
  [...root.children].forEach(disposeObject3D);
  root.clear();
}

function updatePlacementGhosts(root, templateId, variants, theme, plan) {
  clearPlacementGhosts(root);
  if (!plan?.fits || plan.previewPositions.length === 0) return;
  const source = createPlacementPreview(templateId, variants, theme);
  if (!source) return;
  plan.previewPositions.forEach((position, index) => {
    const ghost = index === 0 ? source : source.clone(true);
    ghost.position.set(position.x, 0.04, position.z);
    ghost.rotation.y = plan.footprint.rotationY;
    ghost.scale.set(
      plan.footprint.scale.x,
      plan.footprint.scale.y,
      plan.footprint.scale.z,
    );
    ghost.visible = true;
    root.add(ghost);
  });
}

export default function SiteOverviewScene({
  siteEnvironment = DEFAULT_SITE_ENVIRONMENT,
  buildings,
  floors,
  siteObjects,
  selectedBuildingId,
  selectedSiteObjectId,
  selectedFloorId,
  interiorBuildingId = null,
  focusRequestKey,
  focusMode = false,
  buildingsTranslucent = false,
  cameraStateRef,
  interactionMode,
  placementTemplateId,
  placementVariants,
  areaSelection,
  theme,
  viewMode,
  transformTools,
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
  onPlaceTemplateArea,
  onCancelPlacement,
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const lastFocusedSelectionKeyRef = useRef(null);
  const gridSettingsRef = useRef(gridSettings);
  const gridScopeIdRef = useRef(gridScopeId);
  const interactionModeRef = useRef(interactionMode);
  const placementTemplateIdRef = useRef(placementTemplateId);
  const placementVariantsRef = useRef(placementVariants);
  const areaSelectionRef = useRef(areaSelection);
  const [dragSnapSize, setDragSnapSize] = useState(null);
  const [liveArea, setLiveArea] = useState(null);
  const areaPlacementPlan = useMemo(() => {
    const area = liveArea ?? areaSelection;
    const definition = SITE_CREATION_TEMPLATE_MAP[placementTemplateId];
    if (!area || !definition || interactionMode !== SITE_INTERACTION_MODES.PLACE_OBJECT) return null;
    return placeObjectsInArea({
      area,
      object: definition,
      gridEnabled: gridSettings.enabled,
      cellSize: area.cellSize ?? gridSettings.baseSize,
    });
  }, [areaSelection, gridSettings.baseSize, gridSettings.enabled, interactionMode, liveArea, placementTemplateId]);
  const handlersRef = useRef({});

  useEffect(() => {
    handlersRef.current = {
      onSelectBuilding, onSelectSiteObject, onUpdateBuilding, onUpdateSiteObject,
      onEnterBuilding, onSelectFloor, onEnterFloor, onAreaSelectionChange, onPlaceTemplate, onPlaceTemplateArea, onCancelPlacement,
    };
  }, [onAreaSelectionChange, onCancelPlacement, onEnterBuilding, onEnterFloor, onPlaceTemplate, onPlaceTemplateArea, onSelectBuilding, onSelectFloor, onSelectSiteObject, onUpdateBuilding, onUpdateSiteObject]);

  useEffect(() => {
    gridSettingsRef.current = gridSettings;
    gridScopeIdRef.current = gridScopeId;
    interactionModeRef.current = interactionMode;
    placementTemplateIdRef.current = placementTemplateId;
    placementVariantsRef.current = placementVariants;
    areaSelectionRef.current = areaSelection;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.renderer.domElement.style.cursor = interactionMode === SITE_INTERACTION_MODES.NAVIGATE ? "grab" : "crosshair";
    runtime.areaStart = null;
    runtime.areaEnd = null;
    runtime.placementPointerDown = false;
    runtime.placementAreaStart = null;
    runtime.placementDragArea = null;
    runtime.orbitControls.enabled = !runtime.dragging;
    if (runtime.placementPreview && interactionMode !== SITE_INTERACTION_MODES.PLACE_OBJECT) {
      runtime.placementPreview.visible = false;
    }
    if (interactionMode !== SITE_INTERACTION_MODES.PLACE_OBJECT) {
      updateGridSnapMarker(runtime.gridSnapMarker, { x: 0, z: 0 }, false);
    }
  }, [areaSelection, gridScopeId, gridSettings, interactionMode, placementTemplateId, placementVariants]);

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

    const perspectiveCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
    perspectiveCamera.position.copy(OVERVIEW_CAMERA);
    const orthographicCamera = new THREE.OrthographicCamera(-60, 60, 60, -60, 0.1, 500);
    orthographicCamera.position.set(0, 140, 0);
    orthographicCamera.up.set(0, 0, -1);
    orthographicCamera.lookAt(0, 0, 0);
    const orbitControls = new OrbitControls(perspectiveCamera, renderer.domElement);
    orbitControls.target.copy(OVERVIEW_TARGET);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.minDistance = 8;
    orbitControls.maxDistance = 480;
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.015;
    orbitControls.update();

    const transformControls = createDualTransformControls(perspectiveCamera, renderer.domElement, scene);
    const objectRoot = new THREE.Group();
    objectRoot.name = "부지 오브젝트";
    scene.add(objectRoot);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0x9ca7ad, roughness: 0.92, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.045;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = createSiteGrid(
      DEFAULT_SITE_ENVIRONMENT.width,
      DEFAULT_SITE_ENVIRONMENT.depth,
      DEFAULT_GRID_SETTINGS.baseSize,
      SITE_VISUAL_THEMES.dark,
    );
    scene.add(grid);
    const gridRegionRoot = new THREE.Group();
    scene.add(gridRegionRoot);
    const gridSnapMarker = createGridSnapMarker(sceneTheme.selection);
    scene.add(gridSnapMarker);

    const groundPicker = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
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
    const placementGhostRoot = new THREE.Group();
    placementGhostRoot.name = "영역 배치 미리보기";
    scene.add(placementGhostRoot);

    const hemisphereLight = new THREE.HemisphereLight(sceneTheme.hemisphereSky, sceneTheme.hemisphereGround, 1.8);
    const keyLight = new THREE.DirectionalLight(sceneTheme.keyLight, 2.4);
    keyLight.position.set(40, 70, 35);
    const fillLight = new THREE.DirectionalLight(sceneTheme.fillLight, 0.8);
    fillLight.position.set(-45, 28, -36);
    scene.add(hemisphereLight, keyLight, fillLight);

    const runtime = {
      container, scene, renderer, perspectiveCamera, orthographicCamera,
      activeCamera: perspectiveCamera, orthographicSize: 120, orbitControls, transformControls, transformTools: { translate: false, rotate: false }, objectRoot,
      buildingObjects: new Map(), siteEnvironmentObjects: new Map(), grid, gridRegionRoot,
      gridSnapMarker, ground, groundPicker, areaGuide, placementGhostRoot, hemisphereLight, keyLight, fillLight,
      dragging: false, areaStart: null, areaEnd: null, placementPointerDown: false, placementAreaStart: null,
      placementDragArea: null, placementPreview: null,
      cameraFocus: null,
      buildingFocusMode: null,
      siteBounds: getSiteBounds(DEFAULT_SITE_ENVIRONMENT),
    };
    runtimeRef.current = runtime;
    const removeCameraFocusCancellation = bindCameraFocusCancellation(runtime, renderer.domElement);

    const raycaster = new THREE.Raycaster();
    const pointerStart = new THREE.Vector2();
    const hitGround = (event) => {
      raycaster.setFromCamera(getPointer(event, renderer.domElement), runtime.activeCamera);
      return raycaster.intersectObject(groundPicker, false)[0]?.point ?? null;
    };
    function handlePointerDown(event) {
      pointerStart.set(event.clientX, event.clientY);
      if (event.button !== 0 || dualTransformIsActive(transformControls)) return;
      if (
        interactionModeRef.current === SITE_INTERACTION_MODES.PLACE_OBJECT
        && placementTemplateIdRef.current
      ) {
        if (areaSelectionRef.current) return;
        const point = hitGround(event);
        if (!point) {
          handlersRef.current.onCancelPlacement?.();
          return;
        }
        runtime.placementPointerDown = true;
        runtime.placementAreaStart = snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current, runtime.siteBounds);
        runtime.placementDragArea = null;
        runtime.orbitControls.enabled = false;
        renderer.domElement.setPointerCapture?.(event.pointerId);
        return;
      }
      if (interactionModeRef.current !== SITE_INTERACTION_MODES.AREA_SELECT) return;
      const point = hitGround(event);
      if (!point) return;
      runtime.areaStart = snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current, runtime.siteBounds);
      runtime.areaEnd = runtime.areaStart;
      runtime.orbitControls.enabled = false;
      const area = createArea(runtime.areaStart, runtime.areaStart, runtime.siteBounds);
      updateAreaGuide(runtime.areaGuide, area);
      setLiveArea(area);
      renderer.domElement.setPointerCapture?.(event.pointerId);
    }
    function handlePointerMove(event) {
      if (runtime.areaStart) {
        const point = hitGround(event);
        if (!point) return;
        runtime.areaEnd = snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current, runtime.siteBounds);
        const area = createArea(runtime.areaStart, runtime.areaEnd, runtime.siteBounds);
        updateAreaGuide(runtime.areaGuide, area);
        setLiveArea(area);
        return;
      }
      if (runtime.placementPointerDown && runtime.placementAreaStart) {
        const pointerDistance = pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
        if (pointerDistance > 5) {
          const point = hitGround(event);
          if (!point) return;
          const area = createArea(
            runtime.placementAreaStart,
            snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current, runtime.siteBounds),
            runtime.siteBounds,
          );
          runtime.placementDragArea = area;
          if (runtime.placementPreview) runtime.placementPreview.visible = false;
          setLiveArea(area);
          return;
        }
      }
      if (
        interactionModeRef.current !== SITE_INTERACTION_MODES.PLACE_OBJECT
        || !placementTemplateIdRef.current
        || !runtime.placementPreview
        || areaSelectionRef.current
      ) return;
      const point = hitGround(event);
      if (!point) {
        runtime.placementPreview.visible = false;
        return;
      }
      const snappedPoint = snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current, runtime.siteBounds);
      runtime.placementPreview.position.set(snappedPoint.x, 0.04, snappedPoint.z);
      clampObjectToSiteBounds(runtime.placementPreview, runtime.siteBounds);
      runtime.placementPreview.visible = true;
      updateGridSnapMarker(runtime.gridSnapMarker, runtime.placementPreview.position, true);
      setDragSnapSize((current) => current === snappedPoint.cellSize ? current : snappedPoint.cellSize);
    }
    function handlePointerUp(event) {
      if (event.button !== 0) return;
      if (runtime.areaStart) {
        const point = hitGround(event);
        const end = point
          ? snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current, runtime.siteBounds)
          : runtime.areaEnd ?? runtime.areaStart;
        const area = createArea(runtime.areaStart, end, runtime.siteBounds);
        runtime.areaStart = null;
        runtime.areaEnd = null;
        runtime.orbitControls.enabled = true;
        setLiveArea(null);
        handlersRef.current.onAreaSelectionChange(area);
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        return;
      }
      if (runtime.placementPointerDown) {
        runtime.placementPointerDown = false;
        const placementArea = runtime.placementDragArea;
        runtime.placementAreaStart = null;
        runtime.placementDragArea = null;
        runtime.orbitControls.enabled = true;
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        if (placementArea) {
          setLiveArea(null);
          const result = handlersRef.current.onPlaceTemplateArea?.(
            placementTemplateIdRef.current,
            placementArea,
            placementVariantsRef.current,
          );
          if (result && !result.canPlace) handlersRef.current.onAreaSelectionChange(placementArea);
          return;
        }
        if (pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;
        const point = hitGround(event);
        if (!point || !placementTemplateIdRef.current) return;
        const snappedPoint = snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current, runtime.siteBounds);
        if (runtime.placementPreview) {
          runtime.placementPreview.position.set(snappedPoint.x, 0.04, snappedPoint.z);
          clampObjectToSiteBounds(runtime.placementPreview, runtime.siteBounds);
          snappedPoint.x = runtime.placementPreview.position.x;
          snappedPoint.z = runtime.placementPreview.position.z;
        }
        const area = createSitePlacementArea(
          placementTemplateIdRef.current,
          snappedPoint,
          snappedPoint.cellSize,
        );
        handlersRef.current.onPlaceTemplate(
          placementTemplateIdRef.current,
          area,
          placementVariantsRef.current,
        );
        return;
      }
      if (pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5 || dualTransformIsActive(transformControls)) return;
      raycaster.setFromCamera(getPointer(event, renderer.domElement), runtime.activeCamera);
      const intersections = raycaster.intersectObjects(objectRoot.children.filter((object) => object.visible), true);
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
      raycaster.setFromCamera(getPointer(event, renderer.domElement), runtime.activeCamera);
      const intersections = raycaster.intersectObjects(
        [...runtime.buildingObjects.values()].filter((object) => object.visible),
        true,
      );
      const floorIntersection = intersections.find((item) => findUserData(item.object, "floorId", objectRoot));
      const floorId = floorIntersection ? findUserData(floorIntersection.object, "floorId", objectRoot) : null;
      if (floorId) return handlersRef.current.onEnterFloor(floorId);
      const [intersection] = intersections;
      const buildingId = intersection ? findUserData(intersection.object, "buildingId", objectRoot) : null;
      if (buildingId) handlersRef.current.onEnterBuilding(buildingId);
    }
    function handleDragOver(event) {
      if (!event.dataTransfer?.types.includes(OBJECT_LIBRARY_DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
    function handleDrop(event) {
      const templateId = event.dataTransfer?.getData(OBJECT_LIBRARY_DRAG_TYPE);
      if (!templateId) return;
      event.preventDefault();
      const point = hitGround(event);
      if (!point) return;
      const snappedPoint = snapAreaPoint(point, gridSettingsRef.current, gridScopeIdRef.current, runtime.siteBounds);
      const area = createSitePlacementArea(templateId, snappedPoint, snappedPoint.cellSize);
      handlersRef.current.onPlaceTemplate(templateId, area, placementVariantsRef.current);
    }
    function previewObjectChange(activeControl) {
      const object = activeControl.object;
      if (!object) return;
      if (activeControl === transformControls.translate) {
        const { position, cellSize } = snapHorizontalPosition(object.position, gridSettingsRef.current, gridScopeIdRef.current);
        updateGridSnapMarker(runtime.gridSnapMarker, position, runtime.dragging && cellSize !== null);
        setDragSnapSize((current) => current === cellSize ? current : cellSize);
      }
      clampObjectToSiteBounds(object, runtime.siteBounds);
    }
    function commitObjectChange(activeControl) {
      const object = activeControl.object;
      if (!object) return;
      if (activeControl === transformControls.translate) {
        const { position } = snapHorizontalPosition(object.position, gridSettingsRef.current, gridScopeIdRef.current);
        object.position.x = position.x;
        object.position.z = position.z;
      }
      clampObjectToSiteBounds(object, runtime.siteBounds);
      const changes = {
        position: { x: object.position.x, y: object.position.y, z: object.position.z },
        rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
      };
      if (object.userData.buildingId) handlersRef.current.onUpdateBuilding(object.userData.buildingId, changes);
      if (object.userData.siteObjectId) handlersRef.current.onUpdateSiteObject(object.userData.siteObjectId, changes);
    }
    function handleDraggingChanged(activeControl, event) {
      orbitControls.enabled = !event.value;
      runtime.dragging = event.value;
      setDualTransformDragging(transformControls, activeControl, event.value, runtime.transformTools);
      if (!event.value) {
        updateGridSnapMarker(runtime.gridSnapMarker, { x: 0, z: 0 }, false);
        setDragSnapSize(null);
      }
    }
    function handlePointerCancel(event) {
      if (runtime.areaStart) {
        const area = createArea(runtime.areaStart, runtime.areaEnd ?? runtime.areaStart, runtime.siteBounds);
        runtime.areaStart = null;
        runtime.areaEnd = null;
        runtime.orbitControls.enabled = true;
        setLiveArea(null);
        handlersRef.current.onAreaSelectionChange(area);
        if (renderer.domElement.hasPointerCapture?.(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
        return;
      }
      if (!runtime.placementPointerDown) return;
      const placementArea = runtime.placementDragArea;
      runtime.placementPointerDown = false;
      runtime.placementAreaStart = null;
      runtime.placementDragArea = null;
      runtime.orbitControls.enabled = true;
      setLiveArea(null);
      if (placementArea) handlersRef.current.onAreaSelectionChange(placementArea);
      if (renderer.domElement.hasPointerCapture?.(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    renderer.domElement.addEventListener("lostpointercapture", handlePointerCancel);
    renderer.domElement.addEventListener("dblclick", handleDoubleClick);
    renderer.domElement.addEventListener("dragover", handleDragOver);
    renderer.domElement.addEventListener("drop", handleDrop);
    const handleTranslateChange = () => previewObjectChange(transformControls.translate);
    const handleRotateChange = () => previewObjectChange(transformControls.rotate);
    const handleTranslateCommit = () => commitObjectChange(transformControls.translate);
    const handleRotateCommit = () => commitObjectChange(transformControls.rotate);
    const handleTranslateDragging = (event) => handleDraggingChanged(transformControls.translate, event);
    const handleRotateDragging = (event) => handleDraggingChanged(transformControls.rotate, event);
    transformControls.translate.addEventListener("objectChange", handleTranslateChange);
    transformControls.rotate.addEventListener("objectChange", handleRotateChange);
    transformControls.translate.addEventListener("mouseUp", handleTranslateCommit);
    transformControls.rotate.addEventListener("mouseUp", handleRotateCommit);
    transformControls.translate.addEventListener("dragging-changed", handleTranslateDragging);
    transformControls.rotate.addEventListener("dragging-changed", handleRotateDragging);
    const resizeObserver = new ResizeObserver(() => {
      resizeRuntime(runtime);
      runtime.refocusSelected?.();
    });
    resizeObserver.observe(container);
    resizeRuntime(runtime);

    let animationFrameId;
    function renderFrame() {
      updateCameraFocus(runtime);
      orbitControls.update();
      clampCameraTargetToSite(runtime);
      renderer.render(scene, runtime.activeCamera);
      animationFrameId = requestAnimationFrame(renderFrame);
    }
    renderFrame();

    return () => {
      runtimeRef.current = null;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      removeCameraFocusCancellation();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      renderer.domElement.removeEventListener("lostpointercapture", handlePointerCancel);
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      renderer.domElement.removeEventListener("dragover", handleDragOver);
      renderer.domElement.removeEventListener("drop", handleDrop);
      transformControls.translate.removeEventListener("objectChange", handleTranslateChange);
      transformControls.rotate.removeEventListener("objectChange", handleRotateChange);
      transformControls.translate.removeEventListener("mouseUp", handleTranslateCommit);
      transformControls.rotate.removeEventListener("mouseUp", handleRotateCommit);
      transformControls.translate.removeEventListener("dragging-changed", handleTranslateDragging);
      transformControls.rotate.removeEventListener("dragging-changed", handleRotateDragging);
      disposeDualTransformControls(transformControls);
      orbitControls.dispose();
      runtime.buildingObjects.forEach(disposeObject3D);
      runtime.siteEnvironmentObjects.forEach(disposeObject3D);
      if (runtime.placementPreview) disposeObject3D(runtime.placementPreview);
      clearPlacementGhosts(runtime.placementGhostRoot);
      disposeObject3D(runtime.gridRegionRoot);
      disposeObject3D(runtime.gridSnapMarker);
      disposeObject3D(runtime.areaGuide);
      ground.geometry.dispose();
      ground.material.dispose();
      groundPicker.geometry.dispose();
      groundPicker.material.dispose();
      disposeObject3D(runtime.grid);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const sceneTheme = SCENE_THEMES[theme];
    const siteTheme = SITE_VISUAL_THEMES[theme];
    const backgroundPreset = SITE_BACKGROUND_PRESETS[siteEnvironment.backgroundTheme]
      ?? SITE_BACKGROUND_PRESETS.DAY;
    const groundPreset = SITE_GROUND_MATERIAL_OPTIONS.find((option) => option.id === siteEnvironment.groundMaterial)
      ?? SITE_GROUND_MATERIAL_OPTIONS[0];
    const width = Math.max(20, siteEnvironment.width);
    const depth = Math.max(20, siteEnvironment.depth);
    const span = Math.max(width, depth);
    const diagonal = Math.hypot(width, depth);
    runtime.siteBounds = getSiteBounds(siteEnvironment);
    runtime.scene.background.set(backgroundPreset.background);
    runtime.scene.fog.color.set(backgroundPreset.fog);
    runtime.scene.fog.near = Math.max(70, span * 0.55);
    runtime.scene.fog.far = Math.max(180, span * 1.8);
    runtime.hemisphereLight.color.set(backgroundPreset.sky);
    runtime.hemisphereLight.groundColor.set(backgroundPreset.ground);
    runtime.keyLight.color.set(backgroundPreset.key);
    runtime.fillLight.color.set(backgroundPreset.fill);
    runtime.ground.scale.set(width, depth, 1);
    runtime.ground.material.color.set(groundPreset.color);
    runtime.ground.material.roughness = groundPreset.roughness;
    runtime.groundPicker.scale.set(width, depth, 1);
    runtime.orbitControls.maxDistance = Math.max(80, diagonal * 4);
    runtime.perspectiveCamera.far = Math.max(500, diagonal * 6);
    runtime.orthographicCamera.far = Math.max(500, diagonal * 6);
    runtime.perspectiveCamera.updateProjectionMatrix();
    runtime.orthographicCamera.updateProjectionMatrix();
    runtime.areaGuide.material.color.set(sceneTheme.selection);
    runtime.areaGuide.children[0].material.color.set(sceneTheme.selection);
    replaceSiteGrid(runtime, siteTheme, gridSettings.baseSize, width, depth);
  }, [gridSettings.baseSize, siteEnvironment, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return undefined;
    if (runtime.placementPreview) {
      runtime.scene.remove(runtime.placementPreview);
      disposeObject3D(runtime.placementPreview);
      runtime.placementPreview = null;
    }
    if (!placementTemplateId || interactionMode !== SITE_INTERACTION_MODES.PLACE_OBJECT) return undefined;
    const preview = createPlacementPreview(placementTemplateId, placementVariants, theme);
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
  }, [interactionMode, placementTemplateId, placementVariants, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.gridRegionRoot.children.forEach(disposeObject3D);
    runtime.gridRegionRoot.clear();
    if (!gridSettings.enabled) return;
    const sceneTheme = SCENE_THEMES[theme];
    const siteBounds = getSiteBounds(siteEnvironment);
    getGridRegionsForScope(gridSettings, gridScopeId)
      .filter((region) => region.enabled)
      .map((region) => clipGridRegionToSite(region, siteBounds))
      .filter(Boolean)
      .forEach((region) => runtime.gridRegionRoot.add(createGridRegionGuide(region, {
          lineColor: sceneTheme.selection,
          boundaryColor: sceneTheme.worldSelection,
        })));
  }, [gridScopeId, gridSettings, siteEnvironment, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const siteTheme = SITE_VISUAL_THEMES[theme];
    const buildingIds = new Set(buildings.map((building) => building.id));
    runtime.buildingObjects.forEach((object, id) => {
      if (!buildingIds.has(id)) {
        if (runtime.transformControls.translate.object === object || runtime.transformControls.rotate.object === object) detachDualTransformControls(runtime.transformControls);
        runtime.objectRoot.remove(object);
        disposeObject3D(object);
        runtime.buildingObjects.delete(id);
      }
    });
    buildings.forEach((building) => {
      const floorCount = getBuildingFloorCount(building.id, floors);
      const selected = building.id === selectedBuildingId;
      const expanded = building.id === interiorBuildingId;
      const signature = getBuildingSignature(building, floorCount, selected, expanded, theme, buildingsTranslucent);
      let object = runtime.buildingObjects.get(building.id);
      if (!object || object.userData.geometrySignature !== signature) {
        if (object) {
          if (runtime.transformControls.translate.object === object || runtime.transformControls.rotate.object === object) detachDualTransformControls(runtime.transformControls);
          runtime.objectRoot.remove(object);
          disposeObject3D(object);
        }
        object = createBuildingObject(building, floors, {
          selected, expanded, selectedFloorId, theme, viewerTranslucent: buildingsTranslucent,
          edgeColor: siteTheme.edge, floorColor: siteTheme.floor,
          apronColor: siteTheme.apron, selectionColor: SCENE_THEMES[theme].selection,
        });
        runtime.buildingObjects.set(building.id, object);
        runtime.objectRoot.add(object);
      }
      object.position.set(building.position.x, building.position.y, building.position.z);
      object.rotation.set(building.rotation.x, building.rotation.y, building.rotation.z);
      clampObjectToSiteBounds(object, runtime.siteBounds);
      if (
        Math.abs(object.position.x - building.position.x) > 1e-5
        || Math.abs(object.position.z - building.position.z) > 1e-5
      ) {
        handlersRef.current.onUpdateBuilding(building.id, {
          position: { x: object.position.x, y: building.position.y, z: object.position.z },
        });
      }
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
        if (runtime.transformControls.translate.object === object || runtime.transformControls.rotate.object === object) detachDualTransformControls(runtime.transformControls);
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
          if (runtime.transformControls.translate.object === object || runtime.transformControls.rotate.object === object) detachDualTransformControls(runtime.transformControls);
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
      clampObjectToSiteBounds(object, runtime.siteBounds);
      if (
        Math.abs(object.position.x - siteObject.position.x) > 1e-5
        || Math.abs(object.position.z - siteObject.position.z) > 1e-5
      ) {
        handlersRef.current.onUpdateSiteObject(siteObject.id, {
          position: { x: object.position.x, y: siteObject.position.y, z: object.position.z },
        });
      }
    });

    const selectedObject = runtime.buildingObjects.get(selectedBuildingId)
      ?? runtime.siteEnvironmentObjects.get(selectedSiteObjectId);
    if (selectedObject && interactionMode === SITE_INTERACTION_MODES.NAVIGATE) {
      attachDualTransformControls(runtime.transformControls, selectedObject, runtime.transformTools, {
        camera: runtime.activeCamera,
        allowVerticalTranslation: runtime.activeCamera.isPerspectiveCamera,
      });
    } else detachDualTransformControls(runtime.transformControls);
  }, [buildings, buildingsTranslucent, floors, interactionMode, interiorBuildingId, selectedBuildingId, selectedFloorId, selectedSiteObjectId, siteEnvironment.depth, siteEnvironment.width, siteObjects, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (focusMode) {
      beginBuildingFocusMode(runtime, cameraStateRef);
      applyBuildingFocusVisibility(runtime, selectedBuildingId);
      return;
    }
    restoreBuildingFocusVisibility(runtime);
  }, [buildings, cameraStateRef, focusMode, selectedBuildingId, siteObjects]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.orthographicSize = Math.max(30, siteEnvironment.width, siteEnvironment.depth) * 1.08;
    resizeRuntime(runtime);
  }, [siteEnvironment.depth, siteEnvironment.width]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const is3D = viewMode === VIEW_MODES.VIEW_3D;
    runtime.activeCamera = is3D ? runtime.perspectiveCamera : runtime.orthographicCamera;
    runtime.orbitControls.object = runtime.activeCamera;
    runtime.orbitControls.enableZoom = true;
    runtime.orbitControls.enableRotate = is3D;
    runtime.orbitControls.screenSpacePanning = !is3D;
    runtime.orbitControls.touches.ONE = is3D ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
    runtime.orbitControls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    configureDualTransformControls(runtime.transformControls, runtime.transformTools, {
      camera: runtime.activeCamera,
      allowVerticalTranslation: is3D,
    });
    runtime.renderer.domElement.setAttribute("aria-label", `${is3D ? "3D" : "2D Top"} 월드 편집 화면`);

    if (is3D) runtime.perspectiveCamera.up.set(0, 1, 0);
    else cancelCameraFocus(runtime);
    resizeRuntime(runtime);
    runtime.orbitControls.update();
  }, [viewMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const selectionKey = selectedBuildingId
      ? `building:${selectedBuildingId}`
      : selectedSiteObjectId
        ? `site-object:${selectedSiteObjectId}`
        : null;
    const selectedObject = runtime.buildingObjects.get(selectedBuildingId)
      ?? runtime.siteEnvironmentObjects.get(selectedSiteObjectId);
    if (!selectedObject) {
      lastFocusedSelectionKeyRef.current = null;
      runtime.refocusSelected = null;
      cancelCameraFocus(runtime);
      return;
    }
    const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId);
    if (focusMode && selectedBuilding) {
      const metadata = selectedBuilding.metadata ?? {};
      const refocus = () => {
        resizeRuntime(runtime);
        return focusCameraOnObjectFront(runtime, selectedObject, {
          direction: selectedBuilding.frontDirection
            ?? selectedBuilding.forward
            ?? selectedBuilding.frontAxis
            ?? metadata.frontDirection
            ?? metadata.forward
            ?? metadata.frontAxis,
          directionSpace: selectedBuilding.frontDirectionSpace
            ?? metadata.frontDirectionSpace
            ?? metadata.directionSpace,
          viewportInsets: measureCameraSafeInsets(runtime),
        });
      };
      runtime.refocusSelected = refocus;
      if (lastFocusedSelectionKeyRef.current !== selectionKey) refocus();
      lastFocusedSelectionKeyRef.current = selectionKey;
      return;
    }
    runtime.refocusSelected = null;
    if (lastFocusedSelectionKeyRef.current !== selectionKey) {
      focusCameraOnObject(runtime, selectedObject);
    }
    lastFocusedSelectionKeyRef.current = selectionKey;
  }, [buildings, focusMode, focusRequestKey, selectedBuildingId, selectedSiteObjectId, viewMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const area = liveArea ?? areaSelection;
    updateAreaGuide(runtime.areaGuide, area, Boolean(area));
    if (!area || !areaPlacementPlan) {
      clearPlacementGhosts(runtime.placementGhostRoot);
      return;
    }
    updatePlacementGhosts(runtime.placementGhostRoot, placementTemplateId, placementVariants, theme, areaPlacementPlan);
  }, [areaPlacementPlan, areaSelection, liveArea, placementTemplateId, placementVariants, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.transformTools = transformTools;
    configureDualTransformControls(runtime.transformControls, transformTools, {
      camera: runtime.activeCamera,
      allowVerticalTranslation: viewMode === VIEW_MODES.VIEW_3D,
    });
  }, [transformTools, viewMode]);

  const selectedPosition = buildings.find((building) => building.id === selectedBuildingId)?.position
    ?? siteObjects.find((object) => object.id === selectedSiteObjectId)?.position;
  const effectiveSnapSize = gridSettings.enabled
    ? dragSnapSize ?? getGridResolutionAtPosition(gridSettings, gridScopeId, selectedPosition)
    : null;
  const displayedArea = liveArea ?? areaSelection;
  const handleCameraReset = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    cancelCameraFocus(runtime);

    if (runtime.refocusSelected?.()) return;

    if (runtime.activeCamera.isPerspectiveCamera) {
      runtime.perspectiveCamera.position.copy(OVERVIEW_CAMERA);
      runtime.perspectiveCamera.up.set(0, 1, 0);
      runtime.orbitControls.target.copy(OVERVIEW_TARGET);
    } else {
      runtime.orthographicCamera.position.set(0, Math.max(100, runtime.orthographicSize), 0.001);
      runtime.orthographicCamera.up.set(0, 0, -1);
      runtime.orthographicCamera.zoom = 1;
      runtime.orthographicCamera.updateProjectionMatrix();
      runtime.orbitControls.target.set(0, 0, 0);
      runtime.orthographicCamera.lookAt(0, 0, 0);
    }
    runtime.orbitControls.update();
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (focusMode) {
      beginBuildingFocusMode(runtime, cameraStateRef);
      return;
    }
    const snapshot = runtime.buildingFocusMode?.cameraSnapshot ?? cameraStateRef?.current;
    if (snapshot) restoreCameraState(runtime, snapshot);
    if (cameraStateRef) cameraStateRef.current = null;
  }, [cameraStateRef, focusMode]);

  return (
    <section className={styles.viewport} aria-label={`부지 ${viewMode === VIEW_MODES.LAYOUT_2D ? "2D" : "3D"} 편집 화면`}>
      <div ref={containerRef} className={styles.canvasMount} />
      <div className={styles.sceneStatus}><span /> {viewMode === VIEW_MODES.LAYOUT_2D ? "평면 편집" : "공간 편집"}</div>
      <button
        type="button"
        className={styles.cameraResetButton}
        onClick={handleCameraReset}
        title="카메라 초기화"
        aria-label="카메라 초기화"
      >
        <ResetIcon size={15} />
        <span>카메라 초기화</span>
      </button>
      {effectiveSnapSize !== null && <div className={styles.gridSnapStatus}>그리드 스냅 · {formatGridResolution(effectiveSnapSize)}</div>}
      {displayedArea && (
        <div className={styles.areaStatus}>
          <strong>{displayedArea.width.toFixed(1)} × {displayedArea.depth.toFixed(1)} m</strong>
          {areaPlacementPlan ? <span>{areaPlacementPlan.canPlace ? `예상 배치 ${areaPlacementPlan.count}개` : areaPlacementPlan.message}</span> : null}
        </div>
      )}
    </section>
  );
}
