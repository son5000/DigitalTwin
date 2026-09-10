import { bindViewerCamera } from "./bindViewerCamera";
import { invalidateWorldSnapshot, scheduleWorldSnapshot } from "./captureWorldSnapshot";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { getMoveAxisConfiguration, getRotationAxisConfiguration } from "@/features/digitalTwin/editor/constants/transformTools";
import { ASSET_TYPES } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { getGroundViewPresentation, GROUND_VIEW_MODES } from "@/features/digitalTwin/editor/model/undergroundModel";
import { EQUIPMENT_REPRESENTATIONS, resolveEquipmentRepresentation } from "@/features/digitalTwin/editor/model/viewerPreset";
import { createEquipmentObject } from "@/features/digitalTwin/editor/objects/EquipmentFactory";
import { normalizeEquipmentPart } from "@/features/digitalTwin/editor/constants/partTemplates";
import { createPartObject } from "@/features/digitalTwin/editor/world/PartFactory";
import { applyAssetAlignment, loadBindingObject } from "@/features/digitalTwin/editor/three/EquipmentAssetViewer";
import { disposeObject3D } from "@/features/digitalTwin/editor/three/disposeObject3D";

import styles from "./EquipmentAssetViewer.module.css";

function fitCamera(camera, controls, object) {
  const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere());
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
  const frustum = new THREE.Mesh(
    new THREE.ConeGeometry(radius, length, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x4da8ff, transparent: true, opacity: 0.12, wireframe: true, depthWrite: false }),
  );
  frustum.position.y = -length / 2;
  frustum.scale.x = Math.max(0.2, Number(sensor.aspectRatio) || 1);
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

export default function EquipmentObservationScene({
  snapshotRequest,
  onSnapshot,
  equipment,
  equipmentList = EMPTY_ITEMS,
  focusEquipmentId,
  selectedPartId = null,
  onEquipmentSelect,
  sensors = EMPTY_ITEMS,
  observationPoints = EMPTY_ITEMS,
  bindings = EMPTY_ITEMS,
  assetBindings = EMPTY_ITEMS,
  viewerPreset,
  selectedSensorId = null,
  groundViewMode = GROUND_VIEW_MODES.VISIBLE,
  transformTools,
  theme = "dark",
  onSensorSelect,
  onSensorChange,
  onCameraControlsChange,
  onZoomChange,
}) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const entries = equipmentList.length ? equipmentList : equipment ? [equipment] : [];
    if (!mount || !entries.length) return undefined;
    let frameId;
    let dragging = false;
    let disposed = false;
    const focusEquipment = entries.find((item) => item.id === focusEquipmentId) ?? (entries.length === 1 ? entries[0] : null);
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
    scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x26333a, 2.2));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(5, 8, 6);
    light.castShadow = true;
    scene.add(light);

    const root = new THREE.Group();
    const equipmentRoot = new THREE.Group();
    root.add(equipmentRoot);
    scene.add(root);
    const renderedEquipment = new Map();
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
      const proxy = createEquipmentObject({ ...displayEquipment, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, {
        theme, viewerTranslucent: false, enableLod: false,
        selected: Boolean(onEquipmentSelect && item.id === focusEquipmentId),
        exposeParts: Boolean(onEquipmentSelect), selectedPartId: item.id === focusEquipmentId ? selectedPartId : null,
      });
      logicalRoot.add(proxy);
      const selectedPart = !item.customAssetId && item.id === focusEquipmentId && Array.isArray(item.parts)
        ? item.parts.find((part) => part?.id === selectedPartId) : null;
      if (selectedPart) {
        logicalRoot.add(createPartObject(normalizeEquipmentPart(selectedPart), displayEquipment, { selected: true, theme, selectionColor: "#ffc14d" }));
      }
      equipmentRoot.add(logicalRoot);
      renderedEquipment.set(item.id, { item, object: logicalRoot, proxy, actual: null, loading: null, position: logicalRoot.position.clone() });
    });
    const detailedBindings = new Map();
    assetBindings.forEach((binding) => {
      if (![ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(binding.assetType)) return;
      detailedBindings.set(binding.equipmentId, binding);
    });

    async function ensureDetailed(entry, binding) {
      if (entry.actual || entry.loading || !binding) return entry.loading;
      entry.loading = loadBindingObject(binding).then((loaded) => {
        if (disposed) {
          disposeObject3D(loaded.object);
          loaded.revoke();
          return;
        }
        const aligned = new THREE.Group();
        aligned.add(loaded.object);
        if (!applyAssetAlignment({ actualObject: loaded.object, aligned }, binding, entry.item)) {
          disposeObject3D(aligned);
          loaded.revoke();
          throw new Error("EMPTY_MODEL");
        }
        aligned.userData.releaseAssetSources = loaded.revoke;
        entry.object.add(aligned);
        entry.actual = aligned;
        invalidateWorldSnapshot(snapshotRequest);
        requestSnapshot();
        if (entry.item.id === focusEquipmentId && !selectedPartId) fitCamera(camera, controls, aligned);
      }).catch((error) => {
        console.warn(`[설비 표현] ${entry.item.name ?? entry.item.id} 상세 모델을 표시하지 못해 간략 모델로 복구했습니다.`, error);
        entry.actual = null;
      }).finally(() => { entry.loading = null; });
      return entry.loading;
    }

    function syncEquipmentRepresentations() {
      renderedEquipment.forEach((entry, equipmentId) => {
        const binding = detailedBindings.get(equipmentId);
        const representation = resolveEquipmentRepresentation({
          preset: viewerPreset,
          equipmentId,
          hasDetailedModel: Boolean(binding),
          selected: equipmentId === focusEquipmentId,
          distance: camera.position.distanceTo(entry.object.getWorldPosition(new THREE.Vector3())),
        });
        const showDetailed = representation === EQUIPMENT_REPRESENTATIONS.DETAILED && !(equipmentId === focusEquipmentId && selectedPartId);
        entry.proxy.visible = !showDetailed || !entry.actual;
        if (entry.actual) entry.actual.visible = showDetailed;
        else if (showDetailed) void ensureDetailed(entry, binding).then(() => {
          if (!disposed && entry.actual && !(equipmentId === focusEquipmentId && selectedPartId)) { entry.proxy.visible = false; entry.actual.visible = true; }
        });
      });
    }

    const bounds = new THREE.Box3().setFromObject(equipmentRoot);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 2) * 3;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(span, span),
      new THREE.MeshStandardMaterial({ color: theme === "light" ? 0xcbd5da : 0x17242b, roughness: 0.94, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(center.x, bounds.min.y - 0.015, center.z);
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(span, 20, theme === "light" ? 0x6f8792 : 0x557484, theme === "light" ? 0x9fb0b7 : 0x2b424d);
    grid.position.set(center.x, bounds.min.y, center.z);
    scene.add(grid);
    const groundPresentation = getGroundViewPresentation(groundViewMode);
    const groundClippingPlanes = groundPresentation.sectioned
      ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)]
      : [];
    renderer.localClippingEnabled = groundPresentation.sectioned;
    floor.visible = groundPresentation.visible;
    grid.visible = groundPresentation.gridVisible;
    floor.material.transparent = groundPresentation.transparent;
    floor.material.opacity = groundPresentation.opacity;
    floor.material.depthWrite = groundPresentation.depthWrite;
    floor.material.clippingPlanes = groundClippingPlanes;
    floor.material.clipShadows = groundPresentation.sectioned;
    floor.material.needsUpdate = true;

    const sensorPositions = new Map();
    const sensorMarkers = new Map();
    sensors.filter((sensor) => sensor.equipmentIds?.some((id) => renderedEquipment.has(id))).forEach((sensor) => {
      const host = sensor.mountMode === "EQUIPMENT" ? renderedEquipment.get(sensor.equipmentIds?.[0]) : null;
      const base = host?.position ?? new THREE.Vector3(-(Number(origin.x) || 0), -(Number(origin.y) || 0), -(Number(origin.z) || 0));
      const position = base.clone().add(new THREE.Vector3(Number(sensor.position?.x) || 0, Number(sensor.position?.y) || 0, Number(sensor.position?.z) || 0));
      const isCamera = (sensor.sensorType ?? sensor.sourceType) === "CAMERA";
      const marker = new THREE.Mesh(
        isCamera ? new THREE.ConeGeometry(0.14, 0.36, 12) : new THREE.SphereGeometry(0.14, 14, 10),
        new THREE.MeshBasicMaterial({ color: sensor.id === selectedSensorId ? 0xffc14d : isCamera ? 0x4da8ff : 0x4de0a8, wireframe: isCamera }),
      );
      marker.position.copy(position);
      marker.rotation.set(Number(sensor.rotation?.x) || 0, Number(sensor.rotation?.y) || 0, Number(sensor.rotation?.z) || 0);
      marker.userData.sensorId = sensor.id;
      marker.userData.sensorBase = base.toArray();
      if (isCamera) addCameraFrustum(marker, sensor);
      root.add(marker);
      sensorPositions.set(sensor.id, position);
      sensorMarkers.set(sensor.id, marker);
    });

    const pointPositions = new Map();
    observationPoints.filter((point) => renderedEquipment.has(point.equipmentId)).forEach((point) => {
      const host = renderedEquipment.get(point.equipmentId);
      const position = host.position.clone().add(new THREE.Vector3(Number(point.localPosition?.x) || 0, Number(point.localPosition?.y) || 0, Number(point.localPosition?.z) || 0));
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc14d }));
      marker.position.copy(position);
      root.add(marker);
      pointPositions.set(point.id, position);
    });

    bindings.filter((binding) => renderedEquipment.has(binding.equipmentId)).forEach((binding) => {
      const start = sensorPositions.get(binding.sourceDeviceId);
      const end = pointPositions.get(binding.observationPointId);
      if (!start || !end) return;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([start, end]),
        new THREE.LineDashedMaterial({ color: 0x68d4ff, dashSize: 0.16, gapSize: 0.1 }),
      );
      line.computeLineDistances();
      root.add(line);
    });

    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    const transform = new TransformControls(camera, renderer.domElement);
    const transformHelper = transform.getHelper();
    scene.add(transformHelper);
    const selectedMarker = sensorMarkers.get(selectedSensorId);
    const axis = getMoveAxisConfiguration(transformTools);
    const rotationAxis = getRotationAxisConfiguration(transformTools);
    const transformActive = Boolean(selectedMarker && (rotationAxis.enabled || axis.enabled));
    transform.enabled = transformActive;
    transformHelper.visible = transformActive;
    transform.setMode(rotationAxis.enabled ? "rotate" : "translate");
    transform.showX = rotationAxis.enabled ? rotationAxis.showX : axis.showX;
    transform.showY = rotationAxis.enabled ? rotationAxis.showY : axis.showY;
    transform.showZ = rotationAxis.enabled ? rotationAxis.showZ : axis.showZ;
    if (transformActive) transform.attach(selectedMarker);
    transform.addEventListener("dragging-changed", (event) => {
      dragging = event.value;
      controls.enabled = !event.value;
      if (event.value || !selectedMarker) return;
      const base = new THREE.Vector3().fromArray(selectedMarker.userData.sensorBase ?? [0, 0, 0]);
      onSensorChange?.(selectedSensorId, {
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
    function handlePointerDown(event) { pointerStart = { x: event.clientX, y: event.clientY }; }
    function handlePointerUp(event) {
      if (dragging || !pointerStart || event.button !== 0 || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
      pointerStart = null;
      raycaster.setFromCamera(pointer(event, renderer.domElement), camera);
      const hit = raycaster.intersectObjects([...sensorMarkers.values()], true)[0];
      const sensorId = hit ? findSensorId(hit.object, root) : null;
      if (sensorId) { onSensorSelect?.(sensorId); return; }
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
    let focusObject = focusEquipment ? renderedEquipment.get(focusEquipment.id).object : equipmentRoot;
    if (selectedPartId) focusObject.traverse((object) => {
      if ((object.isGroup && object.userData.customEquipmentPartId === selectedPartId) || (object.isMesh && object.userData.partId === selectedPartId)) focusObject = object;
    });
    fitCamera(camera, controls, focusObject);
    const disconnectViewerCamera = bindViewerCamera(controls, onCameraControlsChange, onZoomChange);
    controls.addEventListener("end", syncEquipmentRepresentations);
    syncEquipmentRepresentations();

    function resize() {
      const rect = mount.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    function render() {
      controls.update();
      renderer.render(scene, camera);
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
      cancelSnapshot();
      disconnectViewerCamera();
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      controls.removeEventListener("end", syncEquipmentRepresentations);
      transform.detach();
      transform.dispose();
      controls.dispose();
      root.traverse((object) => object.userData.releaseAssetSources?.());
      disposeObject3D(root);
      floor.geometry.dispose();
      floor.material.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [snapshotRequest, onSnapshot, assetBindings, bindings, equipment, equipmentList, focusEquipmentId, selectedPartId, onEquipmentSelect, groundViewMode, observationPoints, onCameraControlsChange, onZoomChange, onSensorChange, onSensorSelect, selectedSensorId, sensors, theme, transformTools, viewerPreset]);

  return <section className={styles.viewer} aria-label="설비와 센서 위치·화각"><div ref={mountRef} className={styles.canvas} /></section>;
}
