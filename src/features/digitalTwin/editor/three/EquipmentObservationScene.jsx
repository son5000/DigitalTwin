import { updateEnclosureDoors } from "../generators/EnclosureGenerator";
import EnclosureDoorControls from "../components/EnclosureDoorControls";
import { advanceEnclosureDoors, enclosureDoorOverride, getEnclosure, getEnclosureSurfaces, getSensorMountPose, projectSensorMount, withDoorOverrides } from "../model/equipmentEnclosure";
import { createSensorSceneLayer } from "./sensorSceneLayer";
import ModelLayerControls from "../components/ModelLayerControls";
import { applyModelLayerAppearance } from "./modelLayerAppearance";
import { bindSensorProjectionLayer, projectionMeshes } from "./sensorProjectionLayer";
import { applyEquipmentEnvironment } from "./equipmentEnvironment";
import { bindViewerCamera } from "./bindViewerCamera";
import { invalidateWorldSnapshot, scheduleWorldSnapshot } from "./captureWorldSnapshot";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createDualTransformControls, attachDualTransformControls, disposeDualTransformControls, detachDualTransformControls, setDualTransformDragging, dualTransformIsActive } from "./dualTransformControls";

import { ASSET_TYPES } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { GROUND_VIEW_MODES, getGroundViewPresentation } from "@/features/digitalTwin/editor/model/undergroundModel";
import { createTerrainMesh, createTerrainGrid } from "../terrain/TerrainMeshFactory";
import { DEFAULT_GRID_SETTINGS } from "../constants/gridSettings";
import { normalizeScanLighting, EQUIPMENT_REPRESENTATIONS, resolveEquipmentRepresentation } from "@/features/digitalTwin/editor/model/viewerPreset";
import { createEquipmentObject, getEquipmentGeometrySignature } from "@/features/digitalTwin/editor/objects/EquipmentFactory";
import { addEquipmentLabel } from "../generators/generatorHelpers";
import { normalizeEquipmentPart } from "@/features/digitalTwin/editor/constants/partTemplates";
import { createPartObject } from "@/features/digitalTwin/editor/world/PartFactory";
import { applyAssetAlignment, loadBindingObject } from "@/features/digitalTwin/editor/three/EquipmentAssetViewer";
import { disposeObject3D } from "@/features/digitalTwin/editor/three/disposeObject3D";
import { createSiteEnvironmentObject } from "../world/SiteEnvironmentFactory";
import { focusEquipmentInWorld, updateViewerCameraRange } from "./viewerEquipmentFocus";
import { bindCameraFocusCancellation, updateCameraFocus } from "./cameraFocus";
import { setScanLoadState } from "./scanLoadState";
import { bindSurfaceRoiInteraction } from "./surfaceRoiInteraction";
import InteractionGuide from "../components/InteractionGuide";
import { captureViewerCamera, restoreEquipmentCamera, rememberViewerCamera, restoreViewerCamera } from "./viewerCameraMemory";
import { applySensorView } from "./sensorCamera";
import { bindMonitoringLayers } from "./monitoringLayers";
import { bindEquipmentCoordinateFrame } from "./equipmentCoordinateFrameLayer.js";

import styles from "./EquipmentAssetViewer.module.css";
function fitCamera(camera, controls, object) {
  const sphere = (object.isBox3 ? object : new THREE.Box3().setFromObject(object)).getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.5);
  const distance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25;
  camera.position.copy(sphere.center).add(new THREE.Vector3(distance * 0.78, distance * 0.58, distance));
  camera.near = Math.max(distance / 200, 0.01);
  camera.far = Math.max(distance * 30, 100);
  camera.updateProjectionMatrix();
  controls.target.copy(sphere.center);
  controls.update();
}

function addCameraFrustum(marker, sensor) {
  const length = Math.max(1, Number(sensor.far) || 10);
  const fov = THREE.MathUtils.clamp(Number(sensor.fieldOfView) || 50, 10, 160);
  const radius = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * length;
  const width = radius * Math.max(.2, Number(sensor.aspectRatio) || 1);
  const corners = [[-width, -length, -radius], [width, -length, -radius], [width, -length, radius], [-width, -length, radius]].map((point) => new THREE.Vector3(...point));
  const points = [];
  corners.forEach((point, index) => points.push(new THREE.Vector3(), point, point, corners[(index + 1) % 4]));
  const frustum = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x4da8ff, transparent: true, opacity: .3 }));
  marker.add(frustum);
}

function pointer(event, element) {
  const bounds = element.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
}

function findSensorId(object, root) {
  let current = object;
  while (current && current !== root) {
    if (current.userData.sensorId) return current.userData.sensorId;
    current = current.parent;
  }
  return null;
}

const EMPTY_ITEMS = [];

function proxySignature(item, includeProxy) {
  const stableDoors = (value) => value ? { ...value, doors: value.doors?.map((door) => Object.fromEntries(Object.entries(door).filter(([key]) => !["open", "angle", "hideWhenOpen"].includes(key)))) } : value;
  const enclosure = item.enclosure ? { ...stableDoors(item.enclosure), rear: stableDoors(item.enclosure.rear) } : undefined;
  const siteShape = item.siteObject ? { ...item.siteObject, position: undefined, rotation: undefined } : null;
  return JSON.stringify([getEquipmentGeometrySignature({ ...item, name: "", showNameLabel: false, enclosure }), item.parts, siteShape, includeProxy]);
}

export default function EquipmentObservationScene({
  snapshotRequest,
  onSnapshot,
  equipment: sourceEquipment,
  equipmentList: sourceEquipmentList = EMPTY_ITEMS,
  overview = false,
  terrainEnvironment = null,
  gridSettings = DEFAULT_GRID_SETTINGS,
  focusEquipmentId,
  preserveWorldOnSelection = false,
  animateEquipmentFocus = false,
  focusSelectionVersion = 0,
  selectedPartId = null,
  onEquipmentSelect,
  sensors = EMPTY_ITEMS,
  observationPoints = EMPTY_ITEMS,
  bindings = EMPTY_ITEMS,
  assetBindings = EMPTY_ITEMS,
  viewerPreset,
  previewReadings = false,
  selectedSensorId = null,
  groundViewMode = GROUND_VIEW_MODES.VISIBLE,
  transformTools,
  theme = "dark",
  onSensorSelect,
  onSensorChange,
  onCameraControlsChange,
  onZoomChange,
  roiOptions,
  monitoringOptions,
  sensorViewId = null,
  cameraController: cameraControllerRef, onAlignmentChange, editorStage, pointOptions,
  cameraMemory: sharedCameraMemory,
  cameraResetVersion = 0,
  cameraScope = "OBSERVATION",
}) {
  // Workflow metadata does not alter any model geometry or asset sources.
  const sceneItem = (item) => item ? { ...item, metadata: { ...item.metadata, detailSetup: undefined, coordinateFrame: undefined } } : null;
  const coordinateEquipmentRef = useRef(sourceEquipment);
  useEffect(() => { coordinateEquipmentRef.current = sourceEquipment ?? sourceEquipmentList.find((item) => item.id === focusEquipmentId); }, [sourceEquipment, sourceEquipmentList, focusEquipmentId]);
  const equipmentKey = JSON.stringify(sceneItem(sourceEquipment));
  const equipmentListKey = JSON.stringify(sourceEquipmentList.map(sceneItem));
  const equipment = useMemo(() => JSON.parse(equipmentKey), [equipmentKey]);
  const equipmentList = useMemo(() => JSON.parse(equipmentListKey), [equipmentListKey]);
  const sensorViewRef = useRef(sensorViewId);
  const pointOptionsRef = useRef(pointOptions);
  const editorStageRef = useRef(editorStage);
  const alignmentCallbackRef = useRef(onAlignmentChange);
  useEffect(() => { sensorViewRef.current = sensorViewId; }, [sensorViewId]);
  useEffect(() => { pointOptionsRef.current = pointOptions; }, [pointOptions]);
  useEffect(() => { editorStageRef.current = editorStage; }, [editorStage]);
  useEffect(() => { alignmentCallbackRef.current = onAlignmentChange; }, [onAlignmentChange]);
  const [placingSensorId, setPlacingSensorId] = useState(null);
  const [placementNotice, setPlacementNotice] = useState("");
  const [projectionPicking, setProjectionPicking] = useState(null);
  const [projectionNotice, setProjectionNotice] = useState("");
  const projectionPickingRef = useRef(null);
  useEffect(() => { projectionPickingRef.current = projectionPicking === selectedSensorId ? projectionPicking : null; }, [projectionPicking, selectedSensorId]);
  const placingSensorRef = useRef(null);
  useEffect(() => { placingSensorRef.current = placingSensorId === selectedSensorId ? placingSensorId : null; }, [placingSensorId, selectedSensorId]);
  const [doorOverrides, setDoorOverrides] = useState({});
  const [modelLayers, setModelLayers] = useState({});
  const modelLayersRef = useRef(modelLayers);
  useEffect(() => { modelLayersRef.current = modelLayers; }, [modelLayers]);
  const doorOverridesRef = useRef(doorOverrides);
  useEffect(() => { doorOverridesRef.current = doorOverrides; }, [doorOverrides]);
  const doorEquipment = equipmentList.find((item) => item.id === focusEquipmentId) ?? equipment ?? (equipmentList.length === 1 ? equipmentList[0] : null);
  const displayedDoorEquipment = doorEquipment ? withDoorOverrides(doorEquipment, doorOverrides[doorEquipment.id]) : null;
  const doorBinding = assetBindings.filter((binding) => binding.equipmentId === doorEquipment?.id && [ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(binding.assetType)).at(-1);
  const hasVisibleEnclosure = displayedDoorEquipment?.enclosure?.enabled && (!doorBinding || doorBinding.includeProxy || ["PROXY", "COMPARE"].includes(doorBinding.displayMode));
  const selectedPointId = pointOptions?.selectedId ?? null;
  const pointEditing = pointOptions?.editing === true;
  const sensorStateRef = useRef(null);
  const readingsRef = useRef(null);
  const sensorCallbacksRef = useRef({ onSensorSelect, onSensorChange });
  useEffect(() => { sensorStateRef.current = { sensors, observationPoints, bindings, selectedSensorId, selectedPointId, pointEditing, transformTools, previewReadings }; }, [sensors, observationPoints, bindings, selectedSensorId, selectedPointId, pointEditing, transformTools, previewReadings]);
  useEffect(() => { sensorCallbacksRef.current = { onSensorSelect, onSensorChange }; }, [onSensorSelect, onSensorChange]);
  const lightingRef = useRef(normalizeScanLighting(viewerPreset?.lighting));
  useEffect(() => { lightingRef.current = normalizeScanLighting(viewerPreset?.lighting); }, [viewerPreset?.lighting]);
  const environmentsRef = useRef(viewerPreset?.equipmentEnvironments);
  useEffect(() => { environmentsRef.current = viewerPreset?.equipmentEnvironments; }, [viewerPreset?.equipmentEnvironments]);
  const equipmentViewsRef = useRef(viewerPreset?.equipmentViews);
  useEffect(() => { equipmentViewsRef.current = viewerPreset?.equipmentViews; }, [viewerPreset?.equipmentViews]);
  const representationKey = JSON.stringify(viewerPreset?.equipmentRepresentation ?? {});
  const mountRef = useRef(null);
  const localCameraMemoryRef = useRef(new Map());
  const focusRequestRef = useRef(null);
  const roiFocusRequestRef = useRef(null);
  const roiOptionsRef = useRef(roiOptions);
  const monitoringOptionsRef = useRef(monitoringOptions);
  useEffect(() => { monitoringOptionsRef.current = monitoringOptions; }, [monitoringOptions]);
  useEffect(() => { roiOptionsRef.current = roiOptions; }, [roiOptions]);
  const focusRuntimeRef = useRef(null);
  const selectedScanRef = useRef(focusEquipmentId);
  useEffect(() => { selectedScanRef.current = focusEquipmentId; }, [focusEquipmentId]);
  const sceneFocusId = preserveWorldOnSelection ? null : focusEquipmentId;
  const scenePartId = preserveWorldOnSelection ? null : selectedPartId;
  const sceneInputsRef = useRef(null);
  useEffect(() => { sceneInputsRef.current = { equipment, equipmentList, assetBindings, representationKey, onEquipmentSelect, onCameraControlsChange, onZoomChange }; }, [equipment, equipmentList, assetBindings, representationKey, onEquipmentSelect, onCameraControlsChange, onZoomChange]);
  const structureKey = JSON.stringify([(equipmentList.length ? equipmentList : equipment ? [equipment] : []).map((item) => item.id),
    assetBindings.map(({ id, equipmentId, assetId, assetType, sourceType, sourceKey, objectUrl, relatedSourceKey, textureSourceKey }) => [id, equipmentId, assetId, assetType, sourceType, sourceKey, objectUrl, relatedSourceKey, textureSourceKey])]);

  useEffect(() => {
    const { equipment, equipmentList, assetBindings } = sceneInputsRef.current;
    const onEquipmentSelect = sceneInputsRef.current.onEquipmentSelect ? (...args) => sceneInputsRef.current.onEquipmentSelect?.(...args) : null;
    const mount = mountRef.current;
    const entries = (equipmentList.length ? equipmentList : equipment ? [equipment] : []).map((item) => withDoorOverrides(item, doorOverridesRef.current[item.id]));
    if (!mount || !entries.length) return undefined;
    const cameraMemory = sharedCameraMemory ?? localCameraMemoryRef.current;
    const cameraKey = JSON.stringify([cameraScope, sceneFocusId, scenePartId, cameraResetVersion, entries.map((item) => item.id).sort()]);
    const savedCamera = cameraMemory.get(cameraKey);
    let allowDetailedFit = !savedCamera && !sensorViewRef.current;
    let frameId;
    let dragging = false;
    let disposed = false;
    const focusEquipment = overview ? null : entries.find((item) => item.id === sceneFocusId) ?? (entries.length === 1 ? entries[0] : null);
    const origin = focusEquipment?.position ?? { x: 0, y: 0, z: 0 };
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === "light" ? 0xe8eef1 : 0x0b1217);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.setAttribute("aria-label", "설비와 센서 위치·화각 3D 화면");
    mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.01, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const stopAutomaticFit = () => { allowDetailedFit = false; };
    controls.addEventListener("start", stopAutomaticFit);
    renderer.domElement.addEventListener("pointerdown", stopAutomaticFit, true);
    renderer.domElement.addEventListener("wheel", stopAutomaticFit, { passive: true });
    const ambientLight = new THREE.HemisphereLight(0xe8f7ff, 0x26333a, 2.1);
    const fillLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight, fillLight);
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(5, 8, 6);
    light.castShadow = true;
    scene.add(light);

    const root = new THREE.Group();
    const equipmentRoot = new THREE.Group();
    root.add(equipmentRoot);
    scene.add(root);
    const renderedEquipment = new Map();
    function createProxy(item) {
      return item.siteObject && !item.enclosure?.enabled ? createSiteEnvironmentObject({ ...item.siteObject, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, visible: true }, { theme, selected: false, selectionColor: SCENE_THEMES[theme].selection, edgeColor: SCENE_THEMES[theme].worldEdge })
        : createEquipmentObject({ ...item, showNameLabel: false, dimensions: { width: 1, height: 1, depth: 1, ...item.dimensions }, appearance: { color: "#6f8f9d", opacity: 1, ...item.appearance }, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, visible: true }, {
          theme, viewerTranslucent: true, enableLod: false, selected: Boolean(onEquipmentSelect && item.id === sceneFocusId), exposeParts: Boolean(onEquipmentSelect && !overview), selectedPartId: item.id === sceneFocusId ? scenePartId : null,
        });
    }
    entries.forEach((item) => {
      const displayEquipment = {
        ...item,
        dimensions: { width: 1, height: 1, depth: 1, ...item.dimensions },
        appearance: { color: "#6f8f9d", opacity: 1, ...item.appearance },
        position: {
          x: (Number(item.position?.x) || 0) - (Number(origin.x) || 0),
          y: (Number(item.position?.y) || 0) - (Number(origin.y) || 0),
          z: (Number(item.position?.z) || 0) - (Number(origin.z) || 0),
        },
        visible: true,
      };
      const logicalRoot = new THREE.Group();
      logicalRoot.position.set(displayEquipment.position.x, displayEquipment.position.y, displayEquipment.position.z);
      logicalRoot.rotation.set(Number(item.rotation?.x) || 0, Number(item.rotation?.y) || 0, Number(item.rotation?.z) || 0);
      logicalRoot.userData.equipmentId = item.id;
      const includeProxy = assetBindings.filter((binding) => binding.equipmentId === item.id && [ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(binding.assetType)).at(-1)?.includeProxy;
      const proxy = createProxy(item, includeProxy);
      logicalRoot.add(proxy);
      const label = addEquipmentLabel(logicalRoot, item.showNameLabel ? item.name : null, item.enclosure?.height ?? item.dimensions?.height ?? 1, SCENE_THEMES[theme].equipmentEdge, SCENE_THEMES[theme]);
      const selectedPart = !item.customAssetId && item.id === sceneFocusId && Array.isArray(item.parts)
        ? item.parts.find((part) => part?.id === scenePartId) : null;
      if (selectedPart) {
        logicalRoot.add(createPartObject(normalizeEquipmentPart(selectedPart), displayEquipment, { selected: true, theme, selectionColor: "#ffc14d" }));
      }
      equipmentRoot.add(logicalRoot);
      renderedEquipment.set(item.id, { item, object: logicalRoot, proxy, label, proxyKey: proxySignature(item, includeProxy), actual: null, loading: null, position: logicalRoot.position.clone() });
    });
    const detailedBindings = new Map();
    assetBindings.forEach((binding) => {
      if (![ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(binding.assetType)) return;
      detailedBindings.set(binding.equipmentId, binding);
    });

    async function ensureDetailed(entry, binding) {
      if (entry.actual || entry.loading || entry.attempted || !binding) return entry.loading;
      entry.attempted = true;
      const controller = new AbortController();
      entry.controller = controller;
      setScanLoadState(entry.item.id, "모델을 불러오는 중입니다…");
      entry.loading = loadBindingObject(binding, { signal: controller.signal }).then((loaded) => {
        if (disposed || controller.signal.aborted) {
          disposeObject3D(loaded.object);
          loaded.revoke();
          return;
        }
        const aligned = new THREE.Group();
        aligned.add(loaded.object);
        if (!applyAssetAlignment({ actualObject: loaded.object, aligned }, detailedBindings.get(entry.item.id) ?? binding, entry.item)) {
          disposeObject3D(aligned);
          loaded.revoke();
          throw new Error("EMPTY_MODEL");
        }
        aligned.userData.releaseAssetSources = loaded.revoke;
        entry.object.add(aligned);
        entry.actual = aligned;
        entry.actualObject = loaded.object;
        setScanLoadState(entry.item.id, "스캔 모델 준비 완료");
        invalidateWorldSnapshot(snapshotRequest);
        requestSnapshot();
        worldBounds.copy(new THREE.Box3().setFromObject(root)).union(new THREE.Box3().setFromObject(floor));
        if (allowDetailedFit && entry.item.id === sceneFocusId && !scenePartId) {
          if (animateEquipmentFocus) focusEquipmentInWorld(focusRuntime, entry.object, entry.item);
          else fitCamera(camera, controls, aligned);
          allowDetailedFit = false;
        }
      }).catch((error) => {
        if (controller.signal.aborted) return;
        setScanLoadState(entry.item.id, error.message.includes("LIMIT") ? "모델이 표시 용량 제한을 초과했습니다. 기존 설비를 표시합니다." : "스캔 모델 로딩 실패. 다시 선택하여 재시도하세요.");
        console.warn(`[설비 표현] ${entry.item.name ?? entry.item.id} 상세 모델을 표시하지 못해 간략 모델로 복구했습니다.`, error);
        entry.actual = null;
      }).finally(() => { entry.loading = null; });
      return entry.loading;
    }

    function syncEquipmentRepresentations() {
      renderedEquipment.forEach((entry, equipmentId) => {
        const selected = equipmentId === selectedScanRef.current;
        if (!selected) {
          if (entry.attempted) {
            entry.controller?.abort();
            if (entry.actual) {
              entry.actual.removeFromParent();
              entry.actual.userData.releaseAssetSources?.();
              disposeObject3D(entry.actual);
              entry.actual = null;
            }
            entry.attempted = false;
            setScanLoadState(equipmentId, "");
          }
          entry.proxy.visible = true;
          const settings = modelLayersRef.current[equipmentId]?.PROXY;
          if (entry.unselectedLayers !== settings) { applyModelLayerAppearance(entry.proxy, settings, true); entry.unselectedLayers = settings; }
          entry.proxy.visible = settings?.visible ?? true;
          return;
        }
        const binding = detailedBindings.get(equipmentId);
        const representation = resolveEquipmentRepresentation({
          preset: { equipmentRepresentation: JSON.parse(sceneInputsRef.current.representationKey) },
          equipmentId,
          hasDetailedModel: Boolean(binding),
          selected,
          distance: camera.position.distanceTo(entry.object.getWorldPosition(new THREE.Vector3())),
        });
        const layers = modelLayersRef.current[equipmentId];
        const showDetailed = (layers?.ACTUAL?.visible ?? (sensorCallbacksRef.current.onSensorChange ? Boolean(binding && binding.displayMode !== "PROXY") : representation === EQUIPMENT_REPRESENTATIONS.DETAILED)) && !scenePartId;
        entry.proxy.visible = !showDetailed || Boolean(entry.actual && (binding?.includeProxy || binding?.displayMode === "COMPARE")) || Boolean(entry.attempted && !entry.loading && !entry.actual);
        if (entry.actual) entry.actual.visible = showDetailed;
        else if (showDetailed && !entry.attempted && !entry.loading) void ensureDetailed(entry, binding).then(() => {
          if (!disposed && entry.actual) syncEquipmentRepresentations();
        });
        if (entry.layerSource !== layers || entry.layerActual !== entry.actual || entry.layerDefault !== `${entry.proxy.visible}:${showDetailed}`) {
          entry.layerDefault = `${entry.proxy.visible}:${showDetailed}`;
          entry.layerSource = layers; entry.layerActual = entry.actual;
          applyModelLayerAppearance(entry.proxy, layers?.PROXY, entry.proxy.visible);
          applyModelLayerAppearance(entry.actual, layers?.ACTUAL, showDetailed);
        } else {
          entry.proxy.visible = layers?.PROXY?.visible ?? entry.proxy.visible;
          if (entry.actual) entry.actual.visible = layers?.ACTUAL?.visible ?? showDetailed;
        }
      });
    }

    const bounds = new THREE.Box3().setFromObject(equipmentRoot);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 2) * 3;
    const floor = terrainEnvironment ? createTerrainMesh(terrainEnvironment) : new THREE.Mesh(
      new THREE.PlaneGeometry(span, span),
      new THREE.MeshStandardMaterial({ color: theme === "light" ? 0xcbd5da : 0x17242b, roughness: 0.94, metalness: 0 }),
    );
    if (!terrainEnvironment) {
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(center.x, bounds.min.y - 0.015, center.z);
    }
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = terrainEnvironment
      ? createTerrainGrid(terrainEnvironment, [], gridSettings.baseSize, { grid: SCENE_THEMES[theme].worldEdge, gridCenter: SCENE_THEMES[theme].worldEdge, edge: SCENE_THEMES[theme].worldEdge })
      : new THREE.GridHelper(span, 20, theme === "light" ? 0x6f8792 : 0x557484, theme === "light" ? 0x9fb0b7 : 0x2b424d);
    if (!terrainEnvironment) grid.position.set(center.x, bounds.min.y, center.z);
    scene.add(grid);
    let environmentKey;
    function syncEnvironment() {
      if (terrainEnvironment) {
        if (environmentKey) return;
        const presentation = getGroundViewPresentation(groundViewMode);
        floor.visible = presentation.visible;
        grid.visible = presentation.gridVisible && gridSettings.enabled;
        floor.traverse((object) => {
          if (!object.material) return;
          object.material.transparent = presentation.transparent;
          object.material.opacity = presentation.opacity;
          object.material.depthWrite = presentation.depthWrite;
        });
        environmentKey = "terrain";
        return;
      }
      const environment = focusEquipment ? environmentsRef.current?.[focusEquipment.id] : null;
      const key = JSON.stringify(environment ?? null);
      if (key === environmentKey) return;
      applyEquipmentEnvironment({ scene, renderer, ground: floor, grid }, environment, groundViewMode, theme);
      environmentKey = key;
    }
    syncEnvironment();

    const sensorLayer = createSensorSceneLayer({ root, renderedEquipment, origin, addCameraFrustum });
    const sensorMarkers = sensorLayer.markers;
    let sensorState = null;
    let lastDoorOverrides = doorOverridesRef.current;
    let selectedMarker = null;
    let viewSensor = null;
    let viewMarker = null;
    let lastViewId;
    let orbitSnapshot = null;
    const transform = createDualTransformControls(camera, renderer.domElement, scene, { translationSnap: 0.001 });
    function syncSensors() {
      const next = sensorStateRef.current;
      const readings = monitoringOptionsRef.current?.readings;
      const tick = Math.floor((monitoringOptionsRef.current?.now ?? 0) / 1000);
      const readingKey = readings?.length ? tick : 0;
      if (!next || (sensorState === next && readingsRef.current?.readings === readings && readingsRef.current?.tick === readingKey) || dragging) return false;
      sensorState = next;
      readingsRef.current = { readings, tick: readingKey };
      const { selectedSensorId, transformTools } = next;
      detachDualTransformControls(transform);
      sensorLayer.update({ ...next, readings, now: monitoringOptionsRef.current?.now });
      selectedMarker = pointOptionsRef.current?.editing && next.selectedPointId ? sensorLayer.pointMarkers.get(next.selectedPointId) : sensorMarkers.get(selectedSensorId);
      if ((!editorStageRef.current || editorStageRef.current === "SENSOR" || (editorStageRef.current === "POINT" && selectedMarker?.userData.observationPointId)) && !placingSensorRef.current && !projectionPickingRef.current && !sensorViewRef.current && selectedMarker && sensorCallbacksRef.current.onSensorChange) attachDualTransformControls(transform, selectedMarker, transformTools, { camera });
      else { transform.translate.enabled = false; transform.rotate.enabled = false; }
      return true;
    }
    function syncSensorView() {
      const id = sensorViewRef.current;
      const changed = lastViewId !== id;
      if (changed && !lastViewId && id) orbitSnapshot = captureViewerCamera(camera, controls);
      viewSensor = sensorStateRef.current?.sensors.find((sensor) => sensor.id === id);
      viewMarker = sensorMarkers.get(id);
      if (viewSensor && viewMarker) {
        detachDualTransformControls(transform);
        applySensorView(camera, viewMarker, viewSensor); controls.enabled = false;
        focusRuntime.cameraFocus = null; allowDetailedFit = false;
      } else if (changed && lastViewId) {
        restoreViewerCamera(camera, controls, orbitSnapshot); controls.enabled = true;
        renderer.setScissorTest(false);
      }
      lastViewId = id;
      return changed;
    }
    syncSensors();

    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    for (const control of [transform.translate, transform.rotate]) control.addEventListener("dragging-changed", (event) => {
      dragging = event.value;
      setDualTransformDragging(transform, control, event.value, sensorStateRef.current?.transformTools);
      controls.enabled = !event.value;
      if (event.value) pointerStart = null;
      if (event.value || !selectedMarker) return;
      if (selectedMarker.userData.observationPointId) {
        pointOptionsRef.current?.onChange?.(selectedMarker.userData.observationPointId, { localPosition: { x: selectedMarker.position.x, y: selectedMarker.position.y, z: selectedMarker.position.z } }); return;
      }
      const sensor = sensorStateRef.current.sensors.find((item) => item.id === selectedMarker.userData.sensorId);
      if (sensor?.surfaceMount) {
        const host = renderedEquipment.get(sensor.surfaceMount.equipmentId);
        const pose = getSensorMountPose(sensor, host?.item);
        if (!pose) return;
        const anchor = projectSensorMount(pose.surface, selectedMarker.position, sensor.surfaceMount.offset);
        const neutral = getSensorMountPose({ ...sensor, rotation: {} }, host.item);
        const quaternion = new THREE.Quaternion().setFromEuler(neutral.rotation).invert().multiply(selectedMarker.quaternion);
        const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
        sensorCallbacksRef.current.onSensorChange?.(sensor.id, { surfaceMount: { ...sensor.surfaceMount, ...anchor }, rotation: { x: rotation.x, y: rotation.y, z: rotation.z } });
        return;
      }
      const base = new THREE.Vector3().fromArray(selectedMarker.userData.sensorBase ?? [0, 0, 0]);
      sensorCallbacksRef.current.onSensorChange?.(selectedMarker.userData.sensorId, {
        position: {
          x: selectedMarker.position.x - base.x,
          y: selectedMarker.position.y - base.y,
          z: selectedMarker.position.z - base.z,
        },
        rotation: { x: selectedMarker.rotation.x, y: selectedMarker.rotation.y, z: selectedMarker.rotation.z },
      });
    });

    const raycaster = new THREE.Raycaster();
    let pointerStart = null;
    let hoveredPointId = null, lastHoverAt = 0;
    function pointHit() {
      const hit = raycaster.intersectObjects([...sensorLayer.pointMarkers.values()].filter((object) => object.visible), true).find((hit) => hit.object.visible);
      let object = hit?.object;
      while (object && !object.userData.observationPointId) object = object.parent;
      return object?.userData.observationPointId ?? null;
    }
    function handlePointerMove(event) {
      if (event.buttons || dragging || sensorViewRef.current) { hoveredPointId = null; return; }
      if (performance.now() - lastHoverAt < 50) return;
      lastHoverAt = performance.now();
      raycaster.setFromCamera(pointer(event, renderer.domElement), camera); hoveredPointId = pointHit();
    }
    function clearPointHover() { hoveredPointId = null; }
    function handlePointerDown(event) { pointerStart = { x: event.clientX, y: event.clientY }; }
    function handlePointerUp(event) {
      if (roiOptionsRef.current?.drawing || roiOptionsRef.current?.pointPicking || sensorViewRef.current || dragging || dualTransformIsActive(transform) || !pointerStart || event.button !== 0 || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
      pointerStart = null;
      raycaster.setFromCamera(pointer(event, renderer.domElement), camera);
      const pointOptions = pointOptionsRef.current;
      if (pointOptions?.editing) {
        if (pointOptions.placing) {
          const entry = renderedEquipment.get(selectedScanRef.current);
          if (!entry) return;
          const candidates = [entry.actual, entry.proxy].filter((object) => object?.visible);
          const hit = raycaster.intersectObjects(candidates, true).find((hit) => {
            if (!hit.object.isMesh && !hit.object.isPoints) return false;
            for (let object = hit.object; object; object = object.parent) if (!object.visible) return false;
            return true;
          });
          if (!hit) return;
          const position = entry.object.worldToLocal(hit.point.clone());
          pointOptions.onAdd?.(entry.item.id, { x: position.x, y: position.y, z: position.z }); pointOptions.onPlaced?.(); return;
        }
        const id = pointHit();
        if (id) pointOptions.onSelect?.(id);
        return;
      }
      if (projectionPickingRef.current) {
        const sensor = sensorStateRef.current.sensors.find((item) => item.id === projectionPickingRef.current);
        const entry = renderedEquipment.get(sensor?.surfaceMount?.equipmentId ?? sensor?.equipmentIds?.[0]);
        if (!entry) return;
        const visible = (object) => { for (let current = object; current; current = current.parent) if (!current.visible) return false; return true; };
        const candidates = [["ACTUAL", entry.actual], ["PROXY", entry.proxy]].flatMap(([kind, model]) => projectionMeshes(model).map((item) => ({ ...item, kind })));
        const hit = raycaster.intersectObjects(candidates.map((item) => item.object), false).find((item) => visible(item.object));
        const target = hit && candidates.find((item) => item.object === hit.object);
        if (!target) { setPlacementNotice("영상이 표시될 부분을 선택하세요."); return; }
        const panel = hit.object.userData.enclosurePanel;
        const normal = hit.face?.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).transformDirection(entry.object.matrixWorld.clone().invert());
        const surface = normal && getEnclosureSurfaces(entry.item).find((s) => (s.id === panel || (panel && s.id.startsWith(`${panel}-`))) && s.normal.dot(normal) > .9);
        sensorCallbacksRef.current.onSensorChange?.(sensor.id, { textureProjection: { ...sensor.textureProjection, target: target.kind,
          surfaceId: surface?.id ?? "", meshPath: target.kind === "ACTUAL" ? target.path : null, meshName: hit.object.name || "선택한 부분" } });
        setProjectionPicking(null); setPlacementNotice(""); return;
      }
      if (placingSensorRef.current) {
        const sensor = sensorStateRef.current.sensors.find((item) => item.id === placingSensorRef.current);
        const entry = renderedEquipment.get(sensor?.equipmentIds?.[0]);
        if (!entry || !sensor) return;
        const visible = (object) => { for (let current = object; current; current = current.parent) if (!current.visible) return false; return true; };
        const hit = raycaster.intersectObject(entry.object, true).find((hit) => hit.object.isMesh && visible(hit.object));
        const panel = hit?.object.userData.enclosurePanel;
        if (!panel) { setPlacementNotice("캐비넷의 내벽이나 문을 선택하세요."); return; }
        entry.object.updateWorldMatrix(true, false);
        const point = entry.object.worldToLocal(hit.point.clone());
        const worldNormal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
        const normal = worldNormal.transformDirection(entry.object.matrixWorld.clone().invert());
        const surface = getEnclosureSurfaces(entry.item).find((surface) => (surface.id === panel || surface.id.startsWith(panel + "-")) && surface.normal.dot(normal) > .9);
        if (!surface) { setPlacementNotice("내벽 또는 문의 앞뒤 면을 선택하세요."); return; }
        const anchor = projectSensorMount(surface, point);
        sensorCallbacksRef.current.onSensorChange?.(sensor.id, { mountMode: "EQUIPMENT", surfaceMount: { equipmentId: entry.item.id, surfaceId: surface.id, ...anchor }, rotation: { x: 0, y: 0, z: 0 } });
        setPlacingSensorId(null); setPlacementNotice("");
        return;
      }
      const pointId = pointHit();
      if (pointId && pointOptions?.onSelect) { pointOptions.onSelect(pointId); return; }
      const hit = raycaster.intersectObjects([...sensorMarkers.values()].filter((marker) => marker.visible), true)[0];
      const sensorId = hit ? findSensorId(hit.object, root) : null;
      if (sensorId) { sensorCallbacksRef.current.onSensorSelect?.(sensorId); return; }
      if (!onEquipmentSelect) return;
      const visible = (object) => {
        for (let current = object; current; current = current.parent) if (!current.visible) return false;
        return true;
      };
      let object = raycaster.intersectObject(equipmentRoot, true).find((entry) => visible(entry.object))?.object;
      let partId = null;
      while (object && object !== equipmentRoot) {
        partId ??= object.userData.customEquipmentPartId ?? object.userData.partId;
        if (object.userData.equipmentId) { onEquipmentSelect(object.userData.equipmentId, partId); return; }
        object = object.parent;
      }
      onEquipmentSelect(null);
    }
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", clearPointHover);
    let focusObject = focusEquipment ? renderedEquipment.get(focusEquipment.id).object : equipmentRoot;
    if (scenePartId) focusObject.traverse((object) => {
      if ((object.isGroup && object.userData.customEquipmentPartId === scenePartId) || (object.isMesh && object.userData.partId === scenePartId)) focusObject = object;
    });
    const focusRuntime = { activeCamera: camera, orbitControls: controls, container: mount };
    const roiInteraction = bindSurfaceRoiInteraction({ renderer, camera, controls, renderedEquipment,
      getOptions: () => roiOptionsRef.current ?? {},
      getPointMarker: (id) => sensorLayer.pointMarkers.get(id),
      focus: (object) => {
        const request = JSON.stringify([roiOptionsRef.current?.selectedId, roiOptionsRef.current?.focusVersion]);
        if (roiFocusRequestRef.current === request) return;
        roiFocusRequestRef.current = request;
        focusEquipmentInWorld(focusRuntime, object, renderedEquipment.get(object.userData.equipmentId)?.item);
      },
      cancelFocus: () => { focusRuntime.cameraFocus = null; },
    });
    focusRuntimeRef.current = { runtime: focusRuntime, renderedEquipment };
    const viewObject = () => {
      const bounds = new THREE.Box3();
      const entries = focusEquipment ? [renderedEquipment.get(focusEquipment.id)] : [...renderedEquipment.values()];
      for (const entry of entries) for (const object of [entry?.proxy, entry?.actual]) if (object?.visible) bounds.union(new THREE.Box3().setFromObject(object));
      if (overview && floor.visible) bounds.union(new THREE.Box3().setFromObject(floor));
      return bounds.isEmpty() ? new THREE.Box3().setFromObject(focusObject) : bounds;
    };
    const stopFit = () => { allowDetailedFit = false; focusRuntime.cameraFocus = null; };
    const coordinateLayer = bindEquipmentCoordinateFrame({ renderer, camera, controls, renderedEquipment,
      getEquipment: () => coordinateEquipmentRef.current, getStage: () => editorStageRef.current, getBinding: (id) => detailedBindings.get(id) });
    const cameraApi = {
      equipmentId: focusEquipment?.id,
      coordinateBounds: coordinateLayer.bounds,
      previewCoordinateFrame: coordinateLayer.preview,
      pickCoordinateOrigin: coordinateLayer.pick,
      coordinateFront: (yaw) => { stopFit(); coordinateLayer.front(yaw); },
      ready: () => Boolean(viewObject()), capture: () => captureViewerCamera(camera, controls),
      preview: (view) => { stopFit(); restoreEquipmentCamera(camera, controls, view); },
      fit: () => { stopFit(); camera.zoom = 1; fitCamera(camera, controls, viewObject()); },
      zoom: (factor) => { stopFit(); camera.zoom = Math.max(.1, Math.min(20, camera.zoom * factor)); camera.updateProjectionMatrix(); },
      zoomLevel: (value) => { stopFit(); camera.zoom = Math.max(.1, Math.min(20, value)); camera.updateProjectionMatrix(); },
      fov: (value) => { stopFit(); camera.fov = value; camera.updateProjectionMatrix(); },
      direction: (direction) => {
        stopFit(); camera.zoom = 1; fitCamera(camera, controls, viewObject());
        const distance = camera.position.distanceTo(controls.target);
        const axes = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0] };
        const snapshot = captureViewerCamera(camera, controls);
        snapshot.position = controls.target.clone().addScaledVector(new THREE.Vector3(...axes[direction]), distance).toArray();
        snapshot.up = direction === "top" ? [0, 0, -1] : [0, 1, 0];
        restoreViewerCamera(camera, controls, snapshot);
      },
      floor: () => {
        const entry = renderedEquipment.get(focusEquipment?.id), binding = detailedBindings.get(focusEquipment?.id);
        if (!entry?.actual || !binding?.alignmentTransform) return;
        const bounds = new THREE.Box3().setFromObject(entry.actual);
        if (!bounds.isEmpty()) alignmentCallbackRef.current?.({ position: { ...binding.alignmentTransform.position, y: entry.actual.position.y - bounds.min.y + entry.object.position.y } }, binding.id);
      },
    };
    if (cameraControllerRef) cameraControllerRef.current = cameraApi;
    const disconnectFocus = bindCameraFocusCancellation(focusRuntime, renderer.domElement);
    // Start from the complete world, then approach the selected equipment from its front.
    const initialView = !scenePartId && focusEquipment && equipmentViewsRef.current?.[focusEquipment.id];
    const restoredInitialView = !savedCamera && restoreEquipmentCamera(camera, controls, initialView, focusEquipment ? renderedEquipment.get(focusEquipment.id).object : null);
    if (restoredInitialView) allowDetailedFit = false;
    if (!restoredInitialView && !restoreViewerCamera(camera, controls, savedCamera)) {
      fitCamera(camera, controls, scenePartId ? focusObject : viewObject());
      if (animateEquipmentFocus && focusEquipment) focusEquipmentInWorld(focusRuntime, focusObject, focusEquipment);
    }
    if (viewSensor && viewMarker) applySensorView(camera, viewMarker, viewSensor);
    const worldBounds = new THREE.Box3().setFromObject(root).union(new THREE.Box3().setFromObject(floor));
    const monitoringLayers = bindMonitoringLayers({ renderedEquipment, getOptions: () => monitoringOptionsRef.current ?? {} });
    const projectionLayer = bindSensorProjectionLayer({ renderer, renderedEquipment, markers: sensorMarkers,
      getOptions: () => monitoringOptionsRef.current, getSensors: () => sensorStateRef.current?.sensors, onError: setProjectionNotice });
    const disconnectViewerCamera = bindViewerCamera(controls, (...args) => sceneInputsRef.current.onCameraControlsChange?.(...args), (...args) => sceneInputsRef.current.onZoomChange?.(...args));
    controls.addEventListener("end", syncEquipmentRepresentations);
    syncEquipmentRepresentations();

    function resize() {
      const rect = mount.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = viewSensor ? Math.max(.1, Number(viewSensor.aspectRatio) || 16 / 9) : rect.width / rect.height;
      camera.updateProjectionMatrix();
      if (viewSensor) {
        const width = Math.min(rect.width, rect.height * camera.aspect), height = width / camera.aspect;
        renderer.setViewport((rect.width - width) / 2, (rect.height - height) / 2, width, height);
        renderer.setScissor((rect.width - width) / 2, (rect.height - height) / 2, width, height);
      }
    }
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    let sampleStart = performance.now(), sampleFrames = 0;
    let previousFrame = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let previousInputs = sceneInputsRef.current;
    function syncEquipmentInputs() {
      const next = sceneInputsRef.current;
      if (previousInputs === next || dragging) return;
      previousInputs = next;
      detailedBindings.clear();
      next.assetBindings.forEach((binding) => { if ([ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(binding.assetType)) detailedBindings.set(binding.equipmentId, binding); });
      for (const source of next.equipmentList.length ? next.equipmentList : next.equipment ? [next.equipment] : []) {
        const entry = renderedEquipment.get(source.id);
        if (!entry) continue;
        const item = withDoorOverrides(source, doorOverridesRef.current[source.id]);
        const binding = detailedBindings.get(source.id);
        const key = proxySignature(item, binding?.includeProxy);
        entry.object.position.set((item.position?.x ?? 0) - (origin.x ?? 0), (item.position?.y ?? 0) - (origin.y ?? 0), (item.position?.z ?? 0) - (origin.z ?? 0));
        entry.object.rotation.set(item.rotation?.x ?? 0, item.rotation?.y ?? 0, item.rotation?.z ?? 0);
        entry.position.copy(entry.object.position);
        if (entry.proxyKey !== key) {
          entry.proxy.removeFromParent(); disposeObject3D(entry.proxy);
          entry.proxy = createProxy(item, binding?.includeProxy); entry.object.add(entry.proxy);
          entry.proxyKey = key; entry.layerDefault = null; entry.unselectedLayers = null;
        }
        const labelKey = JSON.stringify([item.name, item.showNameLabel, item.enclosure?.height ?? item.dimensions?.height]);
        if (entry.labelKey !== labelKey) {
          if (entry.label) { entry.label.removeFromParent(); disposeObject3D(entry.label); }
          entry.label = addEquipmentLabel(entry.object, item.showNameLabel ? item.name : null, item.enclosure?.height ?? item.dimensions?.height ?? 1, SCENE_THEMES[theme].equipmentEdge, SCENE_THEMES[theme]);
          entry.labelKey = labelKey;
        }
        entry.item = item; entry.doorTarget = item;
        updateEnclosureDoors(entry.proxy, item);
        const alignmentKey = JSON.stringify([binding?.alignmentTransform, item.dimensions]);
        if (entry.actual && entry.alignmentKey !== alignmentKey) {
          applyAssetAlignment({ actualObject: entry.actualObject, aligned: entry.actual }, binding, item);
          entry.alignmentKey = alignmentKey;
        }
        entry.object.updateMatrixWorld(true);
      }
      sensorState = null;
      worldBounds.copy(new THREE.Box3().setFromObject(root)).union(new THREE.Box3().setFromObject(floor));
    }
    function render() {
      const now = performance.now(), delta = Math.max(.001, (now - previousFrame) / 1000); previousFrame = now;
      syncEquipmentInputs();
      if (placingSensorRef.current || projectionPickingRef.current || (editorStageRef.current && !["SENSOR", "POINT"].includes(editorStageRef.current)) || pointOptionsRef.current?.placing) detachDualTransformControls(transform);
      if (lastDoorOverrides !== doorOverridesRef.current && !dragging) {
        lastDoorOverrides = doorOverridesRef.current;
        renderedEquipment.forEach((entry) => {
          const original = sceneInputsRef.current.equipmentList.find((item) => item.id === entry.item.id) ?? sceneInputsRef.current.equipment ?? entry.item;
          entry.doorTarget = withDoorOverrides(original, lastDoorOverrides[entry.item.id]);
        });
      }
      let doorsMoved = false;
      if (!dragging) renderedEquipment.forEach((entry) => {
        if (!entry.doorTarget || entry.doorTarget === entry.item) return;
        entry.item = advanceEnclosureDoors(entry.item, entry.doorTarget, delta, reducedMotion.matches);
        updateEnclosureDoors(entry.proxy, entry.item); doorsMoved = true;
      });
      if (doorsMoved) {
        sensorLayer.updateMountedPoses(sensorStateRef.current?.sensors ?? []);
        if (viewSensor && viewMarker) applySensorView(camera, viewMarker, viewSensor);
      }
      const sensorsChanged = syncSensors();
      if (syncSensorView() || sensorsChanged) resize();
      if (!viewSensor) updateCameraFocus(focusRuntime);
      syncEquipmentRepresentations();
      sensorLayer.updateVisibility(sensorViewRef.current);
      if ((!editorStageRef.current || editorStageRef.current === "SENSOR" || (editorStageRef.current === "POINT" && selectedMarker?.userData.observationPointId)) && !sensorViewRef.current && !placingSensorRef.current && !projectionPickingRef.current && selectedMarker && sensorCallbacksRef.current.onSensorChange) {
        if (selectedMarker.visible && !transform.translate.object) attachDualTransformControls(transform, selectedMarker, sensorStateRef.current?.transformTools, { camera });
        else if (!selectedMarker.visible && transform.translate.object) detachDualTransformControls(transform);
      }
      if (selectedMarker?.userData.observationPointId) { transform.rotate.enabled = false; transform.rotate.getHelper().visible = false; }
      roiInteraction.update();
      coordinateLayer.update();
      monitoringLayers.update();
      projectionLayer.update();
      if (!viewSensor) { controls.update(); updateViewerCameraRange(camera, worldBounds); }
      else { controls.enabled = false; renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true); }
      syncEnvironment();
      ambientLight.intensity = lightingRef.current.ambient;
      light.intensity = lightingRef.current.key;
      fillLight.intensity = lightingRef.current.fill;
      camera.updateMatrixWorld();
      sensorLayer.updateObservationLabels(camera, renderer, pointOptionsRef.current?.selectedId, hoveredPointId, Boolean(sensorViewRef.current));
      renderer.render(scene, camera);
      sampleFrames++;
      const elapsed = performance.now() - sampleStart;
      if (elapsed >= 1000) { if (!document.hidden) monitoringOptionsRef.current?.onFps?.(Math.round(sampleFrames * 1000 / elapsed)); sampleStart = performance.now(); sampleFrames = 0; }
      frameId = requestAnimationFrame(render);
    }
    render();
    let cancelSnapshot = () => {};
    function requestSnapshot() {
      cancelSnapshot();
      cancelSnapshot = scheduleWorldSnapshot({
      request: snapshotRequest, onSnapshot,
      isReady: () => ![...renderedEquipment.values()].some((entry) => entry.loading),
      getSource: () => {
        const roots = snapshotRequest.scope === "SINGLE_EQUIPMENT"
          ? [renderedEquipment.get(snapshotRequest.targetId)?.object]
          : [equipmentRoot, floor];
        if (roots.some((object) => !object)) return null;
        return { renderer, scene, roots, selectionColors: [SCENE_THEMES[theme].selection, "#ffc14d"] };
      },
      });
    }
    requestSnapshot();
    return () => {
      if (cameraControllerRef?.current === cameraApi) cameraControllerRef.current = null;
      rememberViewerCamera(cameraMemory, cameraKey, camera, controls);
      cancelSnapshot();
      disconnectViewerCamera();
      roiInteraction.dispose();
      coordinateLayer.dispose();
      monitoringLayers.dispose();
      projectionLayer.dispose();
      disconnectFocus();
      focusRuntimeRef.current = null;
      disposed = true;
      renderedEquipment.forEach((entry) => { entry.controller?.abort(); setScanLoadState(entry.item.id, ""); });
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", clearPointHover);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerdown", stopAutomaticFit, true);
      renderer.domElement.removeEventListener("wheel", stopAutomaticFit);
      controls.removeEventListener("start", stopAutomaticFit);
      controls.removeEventListener("end", syncEquipmentRepresentations);
      disposeDualTransformControls(transform);
      sensorLayer.dispose();
      controls.dispose();
      root.traverse((object) => object.userData.releaseAssetSources?.());
      disposeObject3D(root);
      disposeObject3D(floor);
      disposeObject3D(grid);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [snapshotRequest, onSnapshot, structureKey, sceneFocusId, scenePartId, animateEquipmentFocus, overview, terrainEnvironment, gridSettings, groundViewMode, theme, sharedCameraMemory, cameraResetVersion, cameraScope, cameraControllerRef]);

  useEffect(() => {
    if (!preserveWorldOnSelection) return;
    const request = JSON.stringify([focusEquipmentId, focusSelectionVersion, cameraResetVersion]);
    if (focusRequestRef.current === request) return;
    const current = focusRuntimeRef.current;
    const entry = current?.renderedEquipment.get(focusEquipmentId);
    if (entry) {
      focusRequestRef.current = request;
      current.runtime.cameraFocus = null;
      if (!restoreEquipmentCamera(current.runtime.activeCamera, current.runtime.orbitControls, equipmentViewsRef.current?.[entry.item.id], entry.object)) focusEquipmentInWorld(current.runtime, entry.object, entry.item);
    }
  }, [preserveWorldOnSelection, focusEquipmentId, focusSelectionVersion, equipmentList, theme, cameraResetVersion]);

  return <section className={styles.viewer} aria-label="설비와 센서 위치·화각">
    <div ref={mountRef} className={styles.canvas} />
    {!overview && doorEquipment && <ModelLayerControls value={modelLayers[doorEquipment.id]} hasScan={Boolean(doorBinding)} scanDefault={Boolean(doorBinding && doorBinding.displayMode !== "PROXY")} shapeDefault={!doorBinding || ["PROXY", "COMPARE"].includes(doorBinding.displayMode) || doorBinding.includeProxy} shapeOpacity={doorEquipment.enclosure?.enabled ? getEnclosure(doorEquipment).opacity : doorEquipment.appearance?.opacity ?? 1} onChange={(value) => setModelLayers((current) => ({ ...current, [doorEquipment.id]: value }))} />}
    {onSensorChange && (!editorStage || editorStage === "SENSOR") && selectedSensorId && !sensorViewId && <div className={styles.surfacePlacement} data-camera-safe-ui>
      {hasVisibleEnclosure && <button type="button" aria-pressed={placingSensorId === selectedSensorId} onClick={() => { setPlacingSensorId(placingSensorId === selectedSensorId ? null : selectedSensorId); setProjectionPicking(null); setPlacementNotice(""); }}>{placingSensorId === selectedSensorId ? "부착 취소" : "외관에 센서 부착"}</button>}
      {sensors.find((sensor) => sensor.id === selectedSensorId)?.textureProjection?.enabled && <button type="button" aria-pressed={projectionPicking === selectedSensorId} onClick={() => { setProjectionPicking(projectionPicking === selectedSensorId ? null : selectedSensorId); setPlacingSensorId(null); setPlacementNotice(""); }}>{projectionPicking === selectedSensorId ? "적용면 선택 취소" : "영상 적용면 선택"}</button>}
      {(placingSensorId === selectedSensorId || projectionPicking === selectedSensorId) && <span role="status">{placementNotice || (projectionPicking ? "영상이 표시될 부분을 클릭하세요." : "벽이나 문의 부착 위치를 클릭하세요.")}</span>}
    </div>}
    {pointOptions?.placing && <><InteractionGuide message="모델 표면을 클릭해 관측 영역을 놓으세요." /><div className={styles.surfacePlacement} data-camera-safe-ui><button type="button" onClick={pointOptions.onPlaced}>영역 지정 취소</button></div></>}
    {(placingSensorId === selectedSensorId || projectionPicking === selectedSensorId) && selectedSensorId && <InteractionGuide key={projectionPicking ? "projection" : "sensor"} message={projectionPicking ? "영상이 표시될 모델 표면을 클릭하세요." : "센서를 부착할 모델 표면을 클릭하세요."} />}
    {projectionNotice && <div className={styles.projectionNotice} role="status" data-camera-safe-ui>{projectionNotice}</div>}
    {!overview && hasVisibleEnclosure && <EnclosureDoorControls equipment={displayedDoorEquipment} onToggle={(index, open, side) => setDoorOverrides((current) => ({ ...current, [doorEquipment.id]: enclosureDoorOverride(doorEquipment, displayedDoorEquipment, index, open, side) }))} />}
  </section>;
}
