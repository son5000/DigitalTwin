import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { getBuildingFootprint } from "@/features/digitalTwin/editor/utils/buildingFootprint";
import { getVerticalStructureOpeningForFloor } from "@/features/digitalTwin/editor/utils/stairStructure";
import { createStairAssemblyObject } from "@/features/digitalTwin/editor/world/StairFactory";
import { createWorldStructureObject, getWorldStructureDimensions } from "@/features/digitalTwin/editor/world/WorldStructureFactory";

import { disposeObject3D } from "./disposeObject3D";
import { createFloorPlacementPreview } from "./floorPlacementPreview";
import { createEquipmentRenderObjects } from "./equipmentInstancing";
import {
  attachDualTransformControls,
  configureDualTransformControls,
  createDualTransformControls,
  detachDualTransformControls,
  disposeDualTransformControls,
  dualTransformIsActive,
  setDualTransformDragging,
} from "./dualTransformControls";
import { createFloorSurfaceMaterial } from "./floorSurfaceMaterial";
import { createFloorSpatialObject } from "./floorSpatialScene";
import styles from "./FloorPlanScene.module.css";

function pointer(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  return new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
}

function findDomainId(object, root) {
  let current = object;
  while (current && current !== root) {
    if (current.userData.equipmentId) return { domain: "EQUIPMENT", id: current.userData.equipmentId };
    if (current.userData.worldStructureId) return { domain: "PLAN", id: current.userData.worldStructureId };
    if (current.userData.spatialId) return { domain: "SPATIAL", entity: { type: current.userData.spatialType, id: current.userData.spatialId } };
    current = current.parent;
  }
  return null;
}

function findSelectableHit(intersections, root) {
  for (const intersection of intersections) {
    const instanceId = intersection.object.userData.equipmentInstanceIds?.[intersection.instanceId];
    if (instanceId) return { intersection, domain: { domain: "EQUIPMENT", id: instanceId } };
    const domain = findDomainId(intersection.object, root);
    if (domain) return { intersection, domain };
  }
  return null;
}

function findEquipmentRoot(object, root) {
  let current = object;
  while (current && current !== root) {
    if (current.userData.equipmentId) return current;
    current = current.parent;
  }
  return object;
}

function addHole(shape, opening) {
  const path = new THREE.Path();
  const cosine = Math.cos(opening.rotation);
  const sine = Math.sin(opening.rotation);
  const points = [[-1,-1],[-1,1],[1,1],[1,-1]].map(([sx, sz]) => {
    const x = sx * opening.width / 2;
    const z = sz * opening.depth / 2;
    return { x: opening.x + x * cosine - z * sine, z: opening.z + x * sine + z * cosine };
  });
  path.moveTo(points[0].x, points[0].z);
  points.slice(1).forEach((point) => path.lineTo(point.x, point.z));
  path.closePath();
  shape.holes.push(path);
}

function createFloor(building, openings, floorStyle) {
  const footprint = getBuildingFootprint(building);
  const shape = new THREE.Shape();
  shape.moveTo(footprint.points[0].x, footprint.points[0].z);
  footprint.points.slice(1).forEach((point) => shape.lineTo(point.x, point.z));
  shape.closePath();
  openings.forEach((opening) => addHole(shape, opening));
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, createFloorSurfaceMaterial(floorStyle, footprint));
  mesh.receiveShadow = true;
  mesh.userData.floorSurface = true;
  mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x6f909d })));
  return mesh;
}

function resize(runtime) {
  const { width, height } = runtime.container.getBoundingClientRect();
  if (!width || !height) return;
  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

export default function FloorPlan3DScene({
  building, floors, currentFloor, floorPlansById, verticalStructures, equipmentByFloorId,
  viewScope, editMode, activePlanTemplateId, activeEquipmentTemplateId,
  selectedStructureId, selectedEquipmentId, theme,
  selectedSpatialEntity = null,
  equipmentTranslucent = true,
  observationPoints = [], monitoringDevices = [], monitoringBindings = [], monitoringMode = false,
  transformTools, onPlanAdd, onEquipmentAdd, onPlanSelect, onEquipmentSelect,
  onPlanTransform, onEquipmentTransform, onObservationPointAdd, onCancelPlacement, externalStatus = "",
  onSpatialSelect,
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const handlersRef = useRef({ onPlanAdd, onEquipmentAdd, onPlanSelect, onEquipmentSelect, onPlanTransform, onEquipmentTransform, onObservationPointAdd, onSpatialSelect, onCancelPlacement });
  const stateRef = useRef({ editMode, activePlanTemplateId, activeEquipmentTemplateId, currentFloor, selectedEquipmentId, monitoringMode, verticalStructures, floorPlansById });
  useEffect(() => { handlersRef.current = { onPlanAdd, onEquipmentAdd, onPlanSelect, onEquipmentSelect, onPlanTransform, onEquipmentTransform, onObservationPointAdd, onSpatialSelect, onCancelPlacement }; }, [onCancelPlacement, onEquipmentAdd, onEquipmentSelect, onEquipmentTransform, onObservationPointAdd, onPlanAdd, onPlanSelect, onPlanTransform, onSpatialSelect]);
  useEffect(() => { stateRef.current = { editMode, activePlanTemplateId, activeEquipmentTemplateId, currentFloor, selectedEquipmentId, monitoringMode, verticalStructures, floorPlansById }; }, [activeEquipmentTemplateId, activePlanTemplateId, currentFloor, editMode, floorPlansById, monitoringMode, selectedEquipmentId, verticalStructures]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const sceneTheme = SCENE_THEMES[theme];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(sceneTheme.background);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-label", "층별 도면과 설비를 확인하는 3D 공간 보기");
    renderer.domElement.setAttribute("role", "application");
    container.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
    camera.position.set(28, 24, 30);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 3, 0);
    controls.enableDamping = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    const transformControls = createDualTransformControls(camera, renderer.domElement, scene);
    const contentRoot = new THREE.Group();
    const helperRoot = new THREE.Group();
    const placementRoot = new THREE.Group();
    scene.add(contentRoot, helperRoot, placementRoot);
    scene.add(new THREE.HemisphereLight(sceneTheme.hemisphereSky, sceneTheme.hemisphereGround, 2));
    const light = new THREE.DirectionalLight(sceneTheme.keyLight, 1.8);
    light.position.set(30, 50, 22);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -40;
    light.shadow.camera.right = 40;
    light.shadow.camera.top = 40;
    light.shadow.camera.bottom = -40;
    scene.add(light);
    const runtime = { container, scene, renderer, camera, controls, transformControls, transformTools: { translate: false, rotate: false }, contentRoot, helperRoot, placementRoot, placementPreview: null, floorPickers: [] };
    runtimeRef.current = runtime;
    const raycaster = new THREE.Raycaster();
    const start = new THREE.Vector2();
    const onDown = (event) => start.set(event.clientX, event.clientY);
    const getActivePlacementTemplate = () => stateRef.current.editMode === "EQUIPMENT"
      ? stateRef.current.activeEquipmentTemplateId
      : stateRef.current.activePlanTemplateId;
    const updatePlacementPreview = (event) => {
      const preview = runtime.placementPreview;
      const templateId = getActivePlacementTemplate();
      if (!preview || !templateId || !stateRef.current.currentFloor) {
        if (preview) preview.visible = false;
        return null;
      }
      raycaster.setFromCamera(pointer(event, renderer.domElement), camera);
      const activeFloorPickers = runtime.floorPickers.filter((picker) => picker.userData.floorId === stateRef.current.currentFloor.id);
      const [floorHit] = activeFloorPickers.length ? raycaster.intersectObjects(activeFloorPickers, false) : [];
      if (!floorHit) {
        preview.visible = false;
        return null;
      }
      const baseY = floorHit.object.position.y;
      const placementElevation = preview.userData.placementElevation ?? 0;
      preview.position.set(floorHit.point.x, baseY + placementElevation + 0.04, floorHit.point.z);
      preview.visible = true;
      return { x: floorHit.point.x, y: placementElevation, z: floorHit.point.z };
    };
    const onUp = (event) => {
      if (dualTransformIsActive(transformControls) || start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;
      raycaster.setFromCamera(pointer(event, renderer.domElement), camera);
      const placementTemplateId = getActivePlacementTemplate();
      const activeContentRoot = runtime.contentRoot;
      const selectableHit = findSelectableHit(
        raycaster.intersectObjects(activeContentRoot.children, true),
        activeContentRoot,
      );
      if (selectableHit) {
        const { intersection, domain } = selectableHit;
        if (placementTemplateId) handlersRef.current.onCancelPlacement?.();
        if (stateRef.current.monitoringMode && stateRef.current.selectedEquipmentId && domain.domain === "EQUIPMENT") {
          const object = findEquipmentRoot(intersection.object, activeContentRoot);
          const localPosition = object.worldToLocal(intersection.point.clone());
          handlersRef.current.onObservationPointAdd?.(domain.id, { x: localPosition.x, y: localPosition.y, z: localPosition.z });
          return;
        }
        if (domain.domain === "EQUIPMENT") handlersRef.current.onEquipmentSelect?.(domain.id);
        else if (domain.domain === "SPATIAL") handlersRef.current.onSpatialSelect?.(domain.entity);
        else handlersRef.current.onPlanSelect?.(domain.id);
        return;
      }
      if (placementTemplateId) {
        const position = updatePlacementPreview(event);
        if (!position) {
          handlersRef.current.onCancelPlacement?.();
          return;
        }
        if (stateRef.current.editMode === "EQUIPMENT") handlersRef.current.onEquipmentAdd?.(placementTemplateId, position);
        else handlersRef.current.onPlanAdd?.(placementTemplateId, position);
        return;
      }
      handlersRef.current.onPlanSelect?.(null);
      handlersRef.current.onEquipmentSelect?.(null);
      handlersRef.current.onSpatialSelect?.(null);
    };
    const handleObjectChange = (activeControl) => {
      const object = activeControl.object;
      if (!object) return;
      const baseY = object.userData.floorBaseY ?? 0;
      if (object.userData.equipmentId) {
        handlersRef.current.onEquipmentTransform?.(object.userData.equipmentId, {
          position: { x: object.position.x, y: Math.max(0, object.position.y - baseY), z: object.position.z },
          rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
        });
      } else if (object.userData.worldStructureId) {
        const structure = stateRef.current.verticalStructures.find((item) => item.id === object.userData.worldStructureId)
          ?? Object.values(stateRef.current.floorPlansById).flatMap((plan) => plan.structures ?? []).find((item) => item.id === object.userData.worldStructureId);
        const applied = handlersRef.current.onPlanTransform?.(object.userData.worldStructureId, {
          position: { x: object.position.x, y: Math.max(0, object.position.y - baseY), z: object.position.z },
          rotation: { x: 0, y: object.rotation.y, z: 0 },
        });
        if (applied === false) {
          if (structure) {
            object.position.set(structure.position.x, (object.userData.floorBaseY ?? 0) + structure.position.y, structure.position.z);
            object.rotation.set(0, structure.rotation?.y ?? 0, 0);
          }
        }
      }
    };
    const handleDragging = (activeControl, event) => {
      controls.enabled = !event.value;
      setDualTransformDragging(transformControls, activeControl, event.value, runtime.transformTools);
    };
    const handleTranslateCommit = () => handleObjectChange(transformControls.translate);
    const handleRotateCommit = () => handleObjectChange(transformControls.rotate);
    const handleTranslateDragging = (event) => handleDragging(transformControls.translate, event);
    const handleRotateDragging = (event) => handleDragging(transformControls.rotate, event);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", updatePlacementPreview);
    const onLeave = () => { if (runtime.placementPreview) runtime.placementPreview.visible = false; };
    renderer.domElement.addEventListener("pointerleave", onLeave);
    transformControls.translate.addEventListener("mouseUp", handleTranslateCommit);
    transformControls.rotate.addEventListener("mouseUp", handleRotateCommit);
    transformControls.translate.addEventListener("dragging-changed", handleTranslateDragging);
    transformControls.rotate.addEventListener("dragging-changed", handleRotateDragging);
    const observer = new ResizeObserver(() => resize(runtime)); observer.observe(container); resize(runtime);
    let frame;
    const render = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render); }; render();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp); renderer.domElement.removeEventListener("pointermove", updatePlacementPreview); renderer.domElement.removeEventListener("pointerleave", onLeave);
      transformControls.translate.removeEventListener("mouseUp", handleTranslateCommit);
      transformControls.rotate.removeEventListener("mouseUp", handleRotateCommit);
      transformControls.translate.removeEventListener("dragging-changed", handleTranslateDragging);
      transformControls.rotate.removeEventListener("dragging-changed", handleRotateDragging);
      disposeDualTransformControls(transformControls);
      controls.dispose();
      disposeObject3D(runtime.contentRoot);
      disposeObject3D(runtime.helperRoot);
      disposeObject3D(runtime.placementRoot);
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return undefined;
    if (runtime.placementPreview) {
      runtime.placementRoot.remove(runtime.placementPreview);
      disposeObject3D(runtime.placementPreview);
      runtime.placementPreview = null;
    }
    const templateId = editMode === "EQUIPMENT" ? activeEquipmentTemplateId : activePlanTemplateId;
    if (!templateId || monitoringMode) return undefined;
    const preview = createFloorPlacementPreview(editMode, templateId, theme);
    if (!preview) return undefined;
    preview.visible = false;
    runtime.placementPreview = preview;
    runtime.placementRoot.add(preview);
    return () => {
      const activeRuntime = runtimeRef.current;
      if (!activeRuntime || activeRuntime.placementPreview !== preview) return;
      activeRuntime.placementRoot.remove(preview);
      disposeObject3D(preview);
      activeRuntime.placementPreview = null;
    };
  }, [activeEquipmentTemplateId, activePlanTemplateId, editMode, monitoringMode, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !building || !currentFloor) return;
    detachDualTransformControls(runtime.transformControls);
    disposeObject3D(runtime.contentRoot); runtime.scene.remove(runtime.contentRoot); runtime.contentRoot = new THREE.Group(); runtime.scene.add(runtime.contentRoot);
    disposeObject3D(runtime.helperRoot); runtime.scene.remove(runtime.helperRoot); runtime.helperRoot = new THREE.Group(); runtime.scene.add(runtime.helperRoot);
    runtime.floorPickers = [];
    const visibleFloors = viewScope === "BUILDING" ? floors : [currentFloor];
    const visibleEquipmentEntries = [];
    visibleFloors.forEach((floor) => {
      const baseY = viewScope === "BUILDING" ? floor.elevation ?? 0 : 0;
      const connectedVertical = verticalStructures.filter((item) => item.applicationScope?.connectedFloorIds?.includes(floor.id));
      const openings = verticalStructures
        .map((structure) => getVerticalStructureOpeningForFloor(
          structure,
          floors,
          floor.id,
          getWorldStructureDimensions(structure),
        ))
        .filter(Boolean);
      const floorPlan = floorPlansById[floor.id];
      if (floorPlan?.floorFootprint?.regions?.length) {
        const spatialObject = createFloorSpatialObject(floorPlan, {
          selected: floor.id === currentFloor.id ? selectedSpatialEntity : null,
          floorStyle: floorPlan.floorStyle,
          openings,
        });
        spatialObject.position.y = baseY;
        spatialObject.userData.floorMeshes.forEach((mesh) => { mesh.userData.floorId = floor.id; runtime.floorPickers.push(mesh); });
        runtime.contentRoot.add(spatialObject);
      } else {
        const floorMesh = createFloor(building, openings, floorPlan?.floorStyle);
        floorMesh.position.y = baseY;
        floorMesh.userData.floorId = floor.id;
        runtime.floorPickers.push(floorMesh);
        runtime.contentRoot.add(floorMesh);
      }
      const structures = [
        ...(floorPlansById[floor.id]?.structures ?? []),
        ...connectedVertical.filter((structure) => structure.type !== "STAIR"),
      ];
      structures.forEach((structure) => {
        const object = createWorldStructureObject(structure, { selected: structure.id === selectedStructureId, theme, sceneTheme: SCENE_THEMES[theme] });
        object.position.y += baseY;
        object.userData.floorBaseY = baseY;
        runtime.contentRoot.add(object);
      });
      (equipmentByFloorId[floor.id] ?? []).forEach((equipment) => visibleEquipmentEntries.push({ equipment, baseY }));
    });
    createEquipmentRenderObjects(visibleEquipmentEntries, {
      selectedEquipmentId,
      theme,
      viewerTranslucent: equipmentTranslucent,
      disableInstancing: monitoringMode,
    }).forEach((object) => runtime.contentRoot.add(object));
    verticalStructures.filter((structure) => structure.type === "STAIR").forEach((stair) => {
      const object = createStairAssemblyObject(stair, floors, {
        selected: stair.id === selectedStructureId,
        sceneTheme: SCENE_THEMES[theme],
        currentFloorId: viewScope === "FLOOR" ? currentFloor.id : null,
        baseElevation: viewScope === "FLOOR" ? currentFloor.elevation ?? 0 : 0,
      });
      object.userData.floorBaseY = 0;
      runtime.contentRoot.add(object);
    });

    const equipmentMap = new Map();
    Object.entries(equipmentByFloorId).forEach(([floorId, items]) => {
      const floor = floors.find((item) => item.id === floorId);
      items.forEach((item) => equipmentMap.set(item.id, { equipment: item, baseY: viewScope === "BUILDING" ? floor?.elevation ?? 0 : 0 }));
    });
    const sensorWorldPosition = (device) => {
      const mounted = device.mountMode === "EQUIPMENT" ? equipmentMap.get(device.equipmentIds?.[0]) : null;
      return new THREE.Vector3(
        (mounted?.equipment.position.x ?? 0) + device.position.x,
        (mounted ? mounted.baseY + mounted.equipment.position.y : 0) + device.position.y,
        (mounted?.equipment.position.z ?? 0) + device.position.z,
      );
    };
    observationPoints.forEach((point) => {
      const target = equipmentMap.get(point.equipmentId);
      if (!target) return;
      const position = new THREE.Vector3(target.equipment.position.x + point.localPosition.x, target.baseY + target.equipment.position.y + point.localPosition.y, target.equipment.position.z + point.localPosition.z);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc14d })); marker.position.copy(position); runtime.helperRoot.add(marker); marker.userData.observationPointId = point.id;
    });
    monitoringDevices.forEach((device) => {
      const geometry = device.sourceType === "CAMERA" ? new THREE.ConeGeometry(0.28, 0.7, 12) : new THREE.SphereGeometry(0.22, 12, 8);
      const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: device.sourceType === "CAMERA" ? 0x4da8ff : 0x4de0a8, wireframe: device.sourceType === "CAMERA" }));
      marker.position.copy(sensorWorldPosition(device)); marker.rotation.set(device.rotation.x, device.rotation.y, device.rotation.z); runtime.helperRoot.add(marker);
      if (device.sourceType === "CAMERA") {
        const length = Math.max(1, device.far ?? device.range ?? 10); const radius = Math.tan(THREE.MathUtils.degToRad(device.fieldOfView ?? device.fov ?? 50) / 2) * length;
        const frustum = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0x4da8ff, transparent: true, opacity: 0.09, wireframe: true }));
        frustum.position.set(0, -length / 2, 0); frustum.scale.x = device.aspectRatio ?? 1; marker.add(frustum);
      }
    });
    monitoringBindings.forEach((binding) => {
      const device = monitoringDevices.find((item) => item.id === binding.sourceDeviceId);
      const point = observationPoints.find((item) => item.id === binding.observationPointId);
      const target = point ? equipmentMap.get(point.equipmentId) : null;
      if (!device || !point || !target) return;
      const targetPosition = new THREE.Vector3(target.equipment.position.x + point.localPosition.x, target.baseY + target.equipment.position.y + point.localPosition.y, target.equipment.position.z + point.localPosition.z);
      const geometry = new THREE.BufferGeometry().setFromPoints([sensorWorldPosition(device), targetPosition]);
      const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: 0x68d4ff, dashSize: 0.3, gapSize: 0.18 }));
      line.computeLineDistances();
      runtime.helperRoot.add(line);
    });
    const selectedObject = editMode === "EQUIPMENT"
      ? [...runtime.contentRoot.children].find((object) => object.userData.equipmentId === selectedEquipmentId)
      : [...runtime.contentRoot.children].find((object) => object.userData.worldStructureId === selectedStructureId);
    if (!monitoringMode && selectedObject) {
      attachDualTransformControls(runtime.transformControls, selectedObject, runtime.transformTools, {
        camera: runtime.camera,
        allowVerticalTranslation: editMode === "EQUIPMENT",
      });
    }
  }, [building, currentFloor, editMode, equipmentByFloorId, equipmentTranslucent, floors, monitoringBindings, monitoringDevices, monitoringMode, observationPoints, selectedEquipmentId, selectedSpatialEntity, selectedStructureId, floorPlansById, theme, verticalStructures, viewScope]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.transformTools = transformTools;
    configureDualTransformControls(runtime.transformControls, monitoringMode ? { translate: false, rotate: false } : transformTools, {
      camera: runtime.camera,
      allowVerticalTranslation: editMode === "EQUIPMENT",
    });
  }, [editMode, monitoringMode, transformTools]);

  return <section className={styles.viewport} aria-label="3D 공간 보기"><div ref={containerRef} className={styles.canvasMount} /><div className={styles.sceneMeta} data-camera-safe-ui><div className={styles.context}><strong>{building?.name}</strong><span>{viewScope === "BUILDING" ? "전체 건축물" : currentFloor?.name}</span></div></div>{externalStatus ? <div className={styles.status}>{externalStatus}</div> : null}</section>;
}
