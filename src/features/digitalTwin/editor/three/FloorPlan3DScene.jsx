import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import {
  createFloorDisplayOffsets,
  sortFloorsByLevel,
} from "@/features/digitalTwin/editor/model/floorDisplay";
import { isFloorShadowEnabled } from "@/features/digitalTwin/editor/model/shadowPolicy";
import { GROUND_VIEW_MODES, normalizeGroundViewMode } from "@/features/digitalTwin/editor/model/undergroundModel";
import { createTextSprite } from "@/features/digitalTwin/editor/objects/createTextSprite";
import { getBuildingFootprint } from "@/features/digitalTwin/editor/utils/buildingFootprint";
import { getStairRenderInstances, getVerticalStructureOpeningForFloor, STAIR_SCOPES } from "@/features/digitalTwin/editor/utils/stairStructure";
import { createStairRenderObject } from "@/features/digitalTwin/editor/world/StairFactory";
import { createWorldStructureObject, getWorldStructureDimensions } from "@/features/digitalTwin/editor/world/WorldStructureFactory";

import { disposeObject3D } from "./disposeObject3D";
import { createFloorPlacementPreview } from "./floorPlacementPreview";
import { createEquipmentRenderObjects } from "./equipmentInstancing";
import {
  attachDualTransformControls,
  configureDualTransformControls,
  createDualTransformControls,
  detachDualTransformControls,
  DISABLED_TRANSFORM_TOOLS,
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

function createFloorRenderGroup(floor, displayOffsetY = 0) {
  const group = new THREE.Group();
  group.name = `FloorRenderGroup:${floor.name}`;
  group.position.y = displayOffsetY;
  group.userData.floorId = floor.id;
  group.userData.renderFloorId = floor.id;
  group.userData.isFloorRenderGroup = true;
  const layers = Object.fromEntries([
    ["slab", "FloorSlab"],
    ["structures", "RoomsWallsDoors"],
    ["equipment", "Equipment"],
    ["vertical", "VerticalStructures"],
    ["stairs", "Stairs"],
    ["sensors", "FloorSensors"],
    ["labels", "FloorLabels"],
  ].map(([key, name]) => {
    const layer = new THREE.Group();
    layer.name = name;
    layer.userData.floorId = floor.id;
    layer.userData.renderFloorId = floor.id;
    group.add(layer);
    return [key, layer];
  }));
  return { group, layers };
}

function markRenderFloor(object, floorId) {
  object.userData.floorId = floorId;
  object.userData.renderFloorId = floorId;
  return object;
}

function applyShadowPolicy(runtime) {
  runtime.renderer.shadowMap.enabled = runtime.shadowEnabled;
  runtime.light.castShadow = runtime.shadowEnabled;
  runtime.floorGroups.forEach((group, floorId) => {
    const enabled = isFloorShadowEnabled({
      shadowEnabled: runtime.shadowEnabled,
      floorDisplayGap: runtime.floorDisplayGap,
      selectedFloorId: runtime.selectedFloorId,
      floorId,
    });
    group.traverse((object) => {
      if (!object.isMesh) return;
      if (object.userData.defaultCastShadow === undefined) object.userData.defaultCastShadow = object.castShadow;
      if (object.userData.defaultReceiveShadow === undefined) object.userData.defaultReceiveShadow = object.receiveShadow;
      object.castShadow = enabled && object.userData.defaultCastShadow;
      object.receiveShadow = enabled && object.userData.defaultReceiveShadow;
    });
  });
}

function collectFloorLabelObjects(floorGroups) {
  const labels = [];
  floorGroups.forEach((group) => group.traverse((object) => {
    if (object.userData.floorLabel) labels.push(object);
  }));
  return labels;
}

function getStoredFloorLocalPosition(object) {
  // FloorRenderGroup.position.y는 부모의 표시 전용 오프셋이므로 로컬 좌표에는 포함되지 않는다.
  const floorBaseY = object.userData.floorBaseY ?? 0;
  return {
    x: object.position.x,
    y: Math.max(0, object.position.y - floorBaseY),
    z: object.position.z,
  };
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

function createGroundViewObject(building, floors, mode) {
  const group = new THREE.Group();
  group.name = "지하 편집 지면";
  if (!building || !floors.some((floor) => Number(floor.level) < 0) || mode === GROUND_VIEW_MODES.HIDDEN) return group;
  const footprint = getBuildingFootprint(building);
  const margin = 12;
  const halfWidth = (Number(building.parameters?.width) || 10) / 2 + margin;
  const halfDepth = (Number(building.parameters?.depth) || 10) / 2 + margin;
  const minimumZ = mode === GROUND_VIEW_MODES.SECTION ? 0 : -halfDepth;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, minimumZ);
  shape.lineTo(halfWidth, minimumZ);
  shape.lineTo(halfWidth, halfDepth);
  shape.lineTo(-halfWidth, halfDepth);
  shape.closePath();
  if (mode !== GROUND_VIEW_MODES.SECTION) {
    const hole = new THREE.Path();
    hole.moveTo(footprint.points[0].x, footprint.points[0].z);
    footprint.points.slice(1).forEach((point) => hole.lineTo(point.x, point.z));
    hole.closePath();
    shape.holes.push(hole);
  }
  const material = new THREE.MeshStandardMaterial({
    color: 0x75836f,
    roughness: 1,
    side: THREE.DoubleSide,
    transparent: mode === GROUND_VIEW_MODES.TRANSLUCENT,
    opacity: mode === GROUND_VIEW_MODES.TRANSLUCENT ? 0.25 : 1,
    depthWrite: mode !== GROUND_VIEW_MODES.TRANSLUCENT,
  });
  const ground = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  ground.rotation.x = Math.PI / 2;
  ground.position.y = 0.015;
  ground.receiveShadow = false;
  group.add(ground);
  return group;
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
  floorDisplayGap = 0, onFloorSelect,
  shadowEnabled = true,
  groundViewMode = GROUND_VIEW_MODES.VISIBLE,
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const handlersRef = useRef({ onPlanAdd, onEquipmentAdd, onPlanSelect, onEquipmentSelect, onPlanTransform, onEquipmentTransform, onObservationPointAdd, onSpatialSelect, onCancelPlacement, onFloorSelect });
  const stateRef = useRef({ editMode, activePlanTemplateId, activeEquipmentTemplateId, currentFloor, selectedEquipmentId, monitoringMode, verticalStructures, floorPlansById });
  useEffect(() => { handlersRef.current = { onPlanAdd, onEquipmentAdd, onPlanSelect, onEquipmentSelect, onPlanTransform, onEquipmentTransform, onObservationPointAdd, onSpatialSelect, onCancelPlacement, onFloorSelect }; }, [onCancelPlacement, onEquipmentAdd, onEquipmentSelect, onEquipmentTransform, onFloorSelect, onObservationPointAdd, onPlanAdd, onPlanSelect, onPlanTransform, onSpatialSelect]);
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
    const groundViewRoot = new THREE.Group();
    scene.add(groundViewRoot, contentRoot, helperRoot, placementRoot);
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
    const runtime = { container, scene, renderer, camera, controls, transformControls, transformTools: DISABLED_TRANSFORM_TOOLS, groundViewRoot, contentRoot, helperRoot, placementRoot, placementPreview: null, floorPickers: [], floorGroups: new Map(), floorLayers: new Map(), floorOffsetTargets: new Map(), floorGuides: [], stairFloorGuides: [], monitoringFloorGuides: [], light, shadowEnabled: true, floorDisplayGap: 0, selectedFloorId: null };
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
      const displayBaseY = floorHit.object.getWorldPosition(new THREE.Vector3()).y;
      const placementElevation = preview.userData.placementElevation ?? 0;
      preview.position.set(floorHit.point.x, displayBaseY + placementElevation + 0.04, floorHit.point.z);
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
      const [floorLabelHit] = raycaster.intersectObjects(collectFloorLabelObjects(runtime.floorGroups), true);
      if (floorLabelHit?.object.userData.floorId) {
        const focus = floorLabelHit.object.getWorldPosition(new THREE.Vector3());
        const deltaY = focus.y - runtime.controls.target.y;
        runtime.controls.target.set(0, focus.y, 0);
        runtime.camera.position.y += deltaY;
        handlersRef.current.onFloorSelect?.(floorLabelHit.object.userData.floorId);
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
      if (object.userData.equipmentId) {
        handlersRef.current.onEquipmentTransform?.(object.userData.equipmentId, {
          position: getStoredFloorLocalPosition(object),
          rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
        });
      } else if (object.userData.worldStructureId) {
        const structure = stateRef.current.verticalStructures.find((item) => item.id === object.userData.worldStructureId)
          ?? Object.values(stateRef.current.floorPlansById).flatMap((plan) => plan.structures ?? []).find((item) => item.id === object.userData.worldStructureId);
        const applied = handlersRef.current.onPlanTransform?.(object.userData.worldStructureId, {
          position: getStoredFloorLocalPosition(object),
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
    const render = () => {
      runtime.floorGroups.forEach((group, floorId) => {
        const target = runtime.floorOffsetTargets.get(floorId) ?? 0;
        group.position.y = THREE.MathUtils.lerp(group.position.y, target, 0.14);
        if (Math.abs(group.position.y - target) < 0.001) group.position.y = target;
      });
      runtime.floorGuides.forEach(({ line, lowerFloor, upperFloor }) => {
        const lowerY = (lowerFloor.elevation ?? 0) + (runtime.floorGroups.get(lowerFloor.id)?.position.y ?? 0);
        const upperY = (upperFloor.elevation ?? 0) + (runtime.floorGroups.get(upperFloor.id)?.position.y ?? 0);
        line.visible = Math.abs((runtime.floorGroups.get(upperFloor.id)?.position.y ?? 0) - (runtime.floorGroups.get(lowerFloor.id)?.position.y ?? 0)) > 0.01;
        line.geometry.setFromPoints([new THREE.Vector3(0, lowerY, 0), new THREE.Vector3(0, upperY, 0)]);
        line.computeLineDistances();
      });
      runtime.monitoringFloorGuides.forEach(({ line, sourcePosition, targetPosition, sourceFloorId, targetFloorId }) => {
        const sourceOffset = runtime.floorGroups.get(sourceFloorId)?.position.y ?? 0;
        const targetOffset = runtime.floorGroups.get(targetFloorId)?.position.y ?? 0;
        line.geometry.setFromPoints([
          sourcePosition.clone().add(new THREE.Vector3(0, sourceOffset, 0)),
          targetPosition.clone().add(new THREE.Vector3(0, targetOffset, 0)),
        ]);
        line.computeLineDistances();
      });
      runtime.stairFloorGuides.forEach(({ line, structure, fromFloor, toFloor }) => {
        const fromOffset = runtime.floorGroups.get(fromFloor.id)?.position.y ?? 0;
        const toOffset = runtime.floorGroups.get(toFloor.id)?.position.y ?? 0;
        const topY = (toFloor.elevation ?? 0) + fromOffset;
        const targetY = (toFloor.elevation ?? 0) + toOffset;
        line.visible = Math.abs(targetY - topY) > 0.01;
        line.geometry.setFromPoints([
          new THREE.Vector3(structure.position.x, topY, structure.position.z),
          new THREE.Vector3(structure.position.x, targetY, structure.position.z),
        ]);
        line.computeLineDistances();
      });
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render);
    }; render();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp); renderer.domElement.removeEventListener("pointermove", updatePlacementPreview); renderer.domElement.removeEventListener("pointerleave", onLeave);
      transformControls.translate.removeEventListener("mouseUp", handleTranslateCommit);
      transformControls.rotate.removeEventListener("mouseUp", handleRotateCommit);
      transformControls.translate.removeEventListener("dragging-changed", handleTranslateDragging);
      transformControls.rotate.removeEventListener("dragging-changed", handleRotateDragging);
      disposeDualTransformControls(transformControls);
      controls.dispose();
      disposeObject3D(runtime.contentRoot);
      disposeObject3D(runtime.groundViewRoot);
      disposeObject3D(runtime.helperRoot);
      disposeObject3D(runtime.placementRoot);
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    [...runtime.groundViewRoot.children].forEach(disposeObject3D);
    runtime.groundViewRoot.clear();
    runtime.groundViewRoot.add(createGroundViewObject(building, floors, normalizeGroundViewMode(groundViewMode)));
  }, [building, floors, groundViewMode]);

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
    const previousFloorOffsets = new Map([...runtime.floorGroups].map(([floorId, group]) => [floorId, group.position.y]));
    detachDualTransformControls(runtime.transformControls);
    disposeObject3D(runtime.contentRoot); runtime.scene.remove(runtime.contentRoot); runtime.contentRoot = new THREE.Group(); runtime.scene.add(runtime.contentRoot);
    disposeObject3D(runtime.helperRoot); runtime.scene.remove(runtime.helperRoot); runtime.helperRoot = new THREE.Group(); runtime.scene.add(runtime.helperRoot);
    runtime.floorPickers = [];
    runtime.floorGroups = new Map();
    runtime.floorLayers = new Map();
    runtime.floorGuides = [];
    runtime.stairFloorGuides = [];
    runtime.monitoringFloorGuides = [];
    const visibleFloors = viewScope === "BUILDING" ? floors : [currentFloor];
    const orderedFloors = sortFloorsByLevel(floors);
    visibleFloors.forEach((floor) => {
      const baseY = viewScope === "BUILDING" ? floor.elevation ?? 0 : 0;
      const { group: floorGroup, layers } = createFloorRenderGroup(
        floor,
        previousFloorOffsets.get(floor.id) ?? runtime.floorOffsetTargets.get(floor.id) ?? 0,
      );
      runtime.floorGroups.set(floor.id, floorGroup);
      runtime.floorLayers.set(floor.id, layers);
      runtime.contentRoot.add(floorGroup);
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
        markRenderFloor(spatialObject, floor.id);
        spatialObject.userData.floorMeshes.forEach((mesh) => { markRenderFloor(mesh, floor.id); runtime.floorPickers.push(mesh); });
        layers.slab.add(spatialObject);
      } else {
        const floorMesh = createFloor(building, openings, floorPlan?.floorStyle);
        floorMesh.position.y = baseY;
        markRenderFloor(floorMesh, floor.id);
        runtime.floorPickers.push(floorMesh);
        layers.slab.add(floorMesh);
      }
      const structures = floorPlansById[floor.id]?.structures ?? [];
      structures.forEach((structure) => {
        const object = createWorldStructureObject(structure, { selected: structure.id === selectedStructureId, theme, sceneTheme: SCENE_THEMES[theme] });
        object.position.y += baseY;
        object.userData.floorBaseY = baseY;
        markRenderFloor(object, floor.id);
        layers.structures.add(object);
      });
      createEquipmentRenderObjects((equipmentByFloorId[floor.id] ?? []).map((equipment) => ({ equipment, baseY })), {
        selectedEquipmentId,
        theme,
        viewerTranslucent: equipmentTranslucent,
        disableInstancing: monitoringMode,
      }).forEach((object) => {
        markRenderFloor(object, floor.id);
        layers.equipment.add(object);
      });
      if (viewScope === "BUILDING") {
        const label = createTextSprite(floor.name, { background: "rgba(19, 34, 42, 0.9)", border: "#69b6c9", color: "#eefcff", scale: { x: 2.2, y: 0.55 } });
        label.position.set(-(building.parameters?.width ?? 20) / 2 - 1.6, baseY + 0.5, 0);
        label.userData.floorLabel = true;
        label.userData.floorId = floor.id;
        layers.labels.add(label);
      }
    });
    if (viewScope === "BUILDING") {
      const orderedVisibleFloors = sortFloorsByLevel(visibleFloors);
      orderedVisibleFloors.slice(0, -1).forEach((lowerFloor, index) => {
        const upperFloor = orderedVisibleFloors[index + 1];
        const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x69b6c9, transparent: true, opacity: 0.32, dashSize: 0.5, gapSize: 0.35 }));
        line.userData.floorSpreadGuide = true;
        runtime.floorGuides.push({ line, lowerFloor, upperFloor });
        runtime.helperRoot.add(line);
      });
    }
    verticalStructures.forEach((structure) => {
      const connectedFloorIds = structure.applicationScope?.connectedFloorIds ?? structure.servedFloorIds ?? [];
      if (viewScope === "FLOOR" && connectedFloorIds.length && !connectedFloorIds.includes(currentFloor.id)) return;
      if (structure.type === "STAIR") {
        getStairRenderInstances(structure, floors).filter((instance) => (
          viewScope === "BUILDING" || instance.renderFloorId === currentFloor.id
        )).forEach((instance) => {
          const ownerLayers = runtime.floorLayers.get(instance.renderFloorId);
          if (!ownerLayers) return;
          const object = createStairRenderObject(structure, instance, {
            selected: structure.id === selectedStructureId,
            sceneTheme: SCENE_THEMES[theme],
            baseElevation: viewScope === "FLOOR" ? currentFloor.elevation ?? 0 : 0,
          });
          markRenderFloor(object, instance.renderFloorId);
          object.userData.floorBaseY = 0;
          ownerLayers.stairs.add(object);
        });
        if (viewScope === "BUILDING" && structure.scope === STAIR_SCOPES.CONNECTING) {
          const fromFloor = orderedFloors.find((floor) => floor.id === structure.fromFloorId);
          const toFloor = orderedFloors.find((floor) => floor.id === structure.toFloorId);
          if (fromFloor && toFloor) {
            const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xf2b84b, transparent: true, opacity: 0.55, dashSize: 0.28, gapSize: 0.18 }));
            runtime.stairFloorGuides.push({ line, structure, fromFloor, toFloor });
            runtime.helperRoot.add(line);
          }
        }
        return;
      }
      const ownerFloorId = structure.fromFloorId ?? structure.applicationScope?.startFloorId ?? structure.floorId ?? currentFloor.id;
      const ownerFloor = floors.find((floor) => floor.id === ownerFloorId);
      const ownerLayers = runtime.floorLayers.get(ownerFloorId);
      if (!ownerLayers) return;
      const object = createWorldStructureObject(structure, {
        selected: structure.id === selectedStructureId,
        sceneTheme: SCENE_THEMES[theme],
        theme,
      });
      const baseY = viewScope === "BUILDING" ? ownerFloor?.elevation ?? 0 : 0;
      object.position.y += baseY;
      markRenderFloor(object, ownerFloorId);
      object.userData.floorBaseY = baseY;
      ownerLayers.vertical.add(object);
    });

    const equipmentMap = new Map();
    Object.entries(equipmentByFloorId).forEach(([floorId, items]) => {
      const floor = floors.find((item) => item.id === floorId);
      items.forEach((item) => equipmentMap.set(item.id, { equipment: item, floorId, baseY: viewScope === "BUILDING" ? floor?.elevation ?? 0 : 0 }));
    });
    const sensorWorldPosition = (device) => {
      const mounted = device.mountMode === "EQUIPMENT" ? equipmentMap.get(device.equipmentIds?.[0]) : null;
      return {
        floorId: mounted?.floorId ?? device.floorId ?? device.parentFloorId ?? currentFloor.id,
        position: new THREE.Vector3(
          (mounted?.equipment.position.x ?? 0) + device.position.x,
          (mounted ? mounted.baseY + mounted.equipment.position.y : 0) + device.position.y,
          (mounted?.equipment.position.z ?? 0) + device.position.z,
        ),
      };
    };
    observationPoints.forEach((point) => {
      const target = equipmentMap.get(point.equipmentId);
      if (!target) return;
      const position = new THREE.Vector3(target.equipment.position.x + point.localPosition.x, target.baseY + target.equipment.position.y + point.localPosition.y, target.equipment.position.z + point.localPosition.z);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc14d }));
      marker.position.copy(position);
      marker.userData.observationPointId = point.id;
      markRenderFloor(marker, target.floorId);
      (runtime.floorLayers.get(target.floorId)?.sensors ?? runtime.helperRoot).add(marker);
    });
    monitoringDevices.forEach((device) => {
      const sensorLocation = sensorWorldPosition(device);
      const geometry = device.sourceType === "CAMERA" ? new THREE.ConeGeometry(0.28, 0.7, 12) : new THREE.SphereGeometry(0.22, 12, 8);
      const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: device.sourceType === "CAMERA" ? 0x4da8ff : 0x4de0a8, wireframe: device.sourceType === "CAMERA" }));
      marker.position.copy(sensorLocation.position);
      marker.rotation.set(device.rotation.x, device.rotation.y, device.rotation.z);
      markRenderFloor(marker, sensorLocation.floorId);
      (runtime.floorLayers.get(sensorLocation.floorId)?.sensors ?? runtime.helperRoot).add(marker);
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
      const source = sensorWorldPosition(device);
      const targetPosition = new THREE.Vector3(target.equipment.position.x + point.localPosition.x, target.baseY + target.equipment.position.y + point.localPosition.y, target.equipment.position.z + point.localPosition.z);
      const geometry = new THREE.BufferGeometry().setFromPoints([source.position, targetPosition]);
      const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: 0x68d4ff, dashSize: 0.3, gapSize: 0.18 }));
      line.computeLineDistances();
      if (source.floorId === target.floorId && runtime.floorLayers.has(target.floorId)) {
        runtime.floorLayers.get(target.floorId).sensors.add(line);
      } else {
        runtime.monitoringFloorGuides.push({ line, sourcePosition: source.position, targetPosition, sourceFloorId: source.floorId, targetFloorId: target.floorId });
        runtime.helperRoot.add(line);
      }
    });
    let selectedObject = null;
    runtime.contentRoot.traverse((object) => {
      if (selectedObject) return;
      if (editMode === "EQUIPMENT" && object.userData.equipmentId === selectedEquipmentId) selectedObject = object;
      if (editMode !== "EQUIPMENT" && object.userData.worldStructureId === selectedStructureId) selectedObject = object;
    });
    if (!monitoringMode && selectedObject) {
      attachDualTransformControls(runtime.transformControls, selectedObject, runtime.transformTools, {
        camera: runtime.camera,
        allowVerticalTranslation: editMode === "EQUIPMENT",
      });
    }
    applyShadowPolicy(runtime);
  }, [building, currentFloor, editMode, equipmentByFloorId, equipmentTranslucent, floors, monitoringBindings, monitoringDevices, monitoringMode, observationPoints, selectedEquipmentId, selectedSpatialEntity, selectedStructureId, floorPlansById, theme, verticalStructures, viewScope]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.floorOffsetTargets = createFloorDisplayOffsets(floors, floorDisplayGap);
    runtime.floorDisplayGap = floorDisplayGap;
    applyShadowPolicy(runtime);
  }, [floorDisplayGap, floors]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.shadowEnabled = shadowEnabled;
    runtime.selectedFloorId = currentFloor?.id ?? null;
    applyShadowPolicy(runtime);
  }, [currentFloor?.id, shadowEnabled]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.transformTools = transformTools;
    configureDualTransformControls(runtime.transformControls, monitoringMode ? DISABLED_TRANSFORM_TOOLS : transformTools, {
      camera: runtime.camera,
      allowVerticalTranslation: editMode === "EQUIPMENT",
    });
  }, [editMode, monitoringMode, transformTools]);

  return <section className={styles.viewport} aria-label="3D 공간 보기"><div ref={containerRef} className={styles.canvasMount} /><div className={styles.sceneMeta} data-camera-safe-ui><div className={styles.context}><strong>{building?.name}</strong><span>{viewScope === "BUILDING" ? "전체 건축물" : currentFloor?.name}</span></div></div>{externalStatus ? <div className={styles.status}>{externalStatus}</div> : null}</section>;
}
