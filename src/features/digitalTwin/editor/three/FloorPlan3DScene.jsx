import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { getBuildingFootprint } from "@/features/digitalTwin/editor/utils/buildingFootprint";
import { getVerticalStructureOpeningForFloor } from "@/features/digitalTwin/editor/utils/stairStructure";
import { createEquipmentObject } from "@/features/digitalTwin/editor/objects/EquipmentFactory";
import { createStairAssemblyObject } from "@/features/digitalTwin/editor/world/StairFactory";
import { createWorldStructureObject, getWorldStructureDimensions } from "@/features/digitalTwin/editor/world/WorldStructureFactory";

import { disposeObject3D } from "./disposeObject3D";
import {
  attachDualTransformControls,
  configureDualTransformControls,
  createDualTransformControls,
  detachDualTransformControls,
  disposeDualTransformControls,
  dualTransformIsActive,
  setDualTransformDragging,
} from "./dualTransformControls";
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
    current = current.parent;
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

function createFloor(building, openings, color) {
  const footprint = getBuildingFootprint(building);
  const shape = new THREE.Shape();
  shape.moveTo(footprint.points[0].x, footprint.points[0].z);
  footprint.points.slice(1).forEach((point) => shape.lineTo(point.x, point.z));
  shape.closePath();
  openings.forEach((opening) => addHole(shape, opening));
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.86, side: THREE.DoubleSide }));
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
  observationPoints = [], monitoringDevices = [], monitoringBindings = [], monitoringMode = false,
  transformTools, onPlanAdd, onEquipmentAdd, onPlanSelect, onEquipmentSelect,
  onPlanTransform, onEquipmentTransform, onObservationPointAdd, externalStatus = "",
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const handlersRef = useRef({ onPlanAdd, onEquipmentAdd, onPlanSelect, onEquipmentSelect, onPlanTransform, onEquipmentTransform, onObservationPointAdd });
  const stateRef = useRef({ editMode, activePlanTemplateId, activeEquipmentTemplateId, currentFloor, selectedEquipmentId, monitoringMode, verticalStructures, floorPlansById });
  useEffect(() => { handlersRef.current = { onPlanAdd, onEquipmentAdd, onPlanSelect, onEquipmentSelect, onPlanTransform, onEquipmentTransform, onObservationPointAdd }; }, [onEquipmentAdd, onEquipmentSelect, onEquipmentTransform, onObservationPointAdd, onPlanAdd, onPlanSelect, onPlanTransform]);
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
    scene.add(contentRoot, helperRoot);
    scene.add(new THREE.HemisphereLight(sceneTheme.hemisphereSky, sceneTheme.hemisphereGround, 2));
    const light = new THREE.DirectionalLight(sceneTheme.keyLight, 1.8); light.position.set(30, 50, 22); scene.add(light);
    const runtime = { container, scene, renderer, camera, controls, transformControls, transformTools: { translate: false, rotate: false }, contentRoot, helperRoot, floorPickers: [] };
    runtimeRef.current = runtime;
    const raycaster = new THREE.Raycaster();
    const start = new THREE.Vector2();
    const onDown = (event) => start.set(event.clientX, event.clientY);
    const onUp = (event) => {
      if (dualTransformIsActive(transformControls) || start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;
      raycaster.setFromCamera(pointer(event, renderer.domElement), camera);
      const [contentHit] = raycaster.intersectObjects(contentRoot.children, true);
      const domain = contentHit ? findDomainId(contentHit.object, contentRoot) : null;
      if (stateRef.current.monitoringMode && stateRef.current.selectedEquipmentId && domain?.domain === "EQUIPMENT") {
        const object = findEquipmentRoot(contentHit.object, contentRoot);
        const localPosition = object.worldToLocal(contentHit.point.clone());
        handlersRef.current.onObservationPointAdd?.(domain.id, { x: localPosition.x, y: localPosition.y, z: localPosition.z });
        return;
      }
      if (domain?.domain === "EQUIPMENT") { handlersRef.current.onEquipmentSelect?.(domain.id); return; }
      if (domain?.domain === "PLAN") { handlersRef.current.onPlanSelect?.(domain.id); return; }
      const [floorHit] = raycaster.intersectObjects(runtime.floorPickers, false);
      if (!floorHit) return;
      const baseY = floorHit.object.position.y;
      const position = { x: floorHit.point.x, y: 0, z: floorHit.point.z };
      if (stateRef.current.editMode === "EQUIPMENT" && stateRef.current.activeEquipmentTemplateId) handlersRef.current.onEquipmentAdd?.(stateRef.current.activeEquipmentTemplateId, position);
      if (stateRef.current.editMode === "PLAN" && stateRef.current.activePlanTemplateId) handlersRef.current.onPlanAdd?.(stateRef.current.activePlanTemplateId, { ...position, y: baseY });
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
        const applied = handlersRef.current.onPlanTransform?.(object.userData.worldStructureId, {
          position: { x: object.position.x, y: 0, z: object.position.z },
          rotation: { x: 0, y: object.rotation.y, z: 0 },
        });
        if (applied === false) {
          const structure = stateRef.current.verticalStructures.find((item) => item.id === object.userData.worldStructureId)
            ?? Object.values(stateRef.current.floorPlansById).flatMap((plan) => plan.structures ?? []).find((item) => item.id === object.userData.worldStructureId);
          if (structure) {
            object.position.set(structure.position.x, object.userData.floorBaseY ?? 0, structure.position.z);
            object.rotation.set(0, structure.rotation?.y ?? 0, 0);
          }
        }
      }
    };
    const handleDragging = (activeControl, event) => {
      controls.enabled = !event.value;
      setDualTransformDragging(transformControls, activeControl, event.value, runtime.transformTools);
    };
    const handleTranslateChange = () => handleObjectChange(transformControls.translate);
    const handleRotateChange = () => handleObjectChange(transformControls.rotate);
    const handleTranslateDragging = (event) => handleDragging(transformControls.translate, event);
    const handleRotateDragging = (event) => handleDragging(transformControls.rotate, event);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    transformControls.translate.addEventListener("objectChange", handleTranslateChange);
    transformControls.rotate.addEventListener("objectChange", handleRotateChange);
    transformControls.translate.addEventListener("dragging-changed", handleTranslateDragging);
    transformControls.rotate.addEventListener("dragging-changed", handleRotateDragging);
    const observer = new ResizeObserver(() => resize(runtime)); observer.observe(container); resize(runtime);
    let frame;
    const render = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render); }; render();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", onDown); renderer.domElement.removeEventListener("pointerup", onUp);
      transformControls.translate.removeEventListener("objectChange", handleTranslateChange);
      transformControls.rotate.removeEventListener("objectChange", handleRotateChange);
      transformControls.translate.removeEventListener("dragging-changed", handleTranslateDragging);
      transformControls.rotate.removeEventListener("dragging-changed", handleRotateDragging);
      disposeDualTransformControls(transformControls); controls.dispose(); disposeObject3D(contentRoot); disposeObject3D(helperRoot); renderer.dispose(); renderer.domElement.remove(); runtimeRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !building || !currentFloor) return;
    detachDualTransformControls(runtime.transformControls);
    disposeObject3D(runtime.contentRoot); runtime.scene.remove(runtime.contentRoot); runtime.contentRoot = new THREE.Group(); runtime.scene.add(runtime.contentRoot);
    disposeObject3D(runtime.helperRoot); runtime.scene.remove(runtime.helperRoot); runtime.helperRoot = new THREE.Group(); runtime.scene.add(runtime.helperRoot);
    runtime.floorPickers = [];
    const visibleFloors = viewScope === "BUILDING" ? floors : [currentFloor];
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
      const floorMesh = createFloor(building, openings, theme === "dark" ? 0x26363d : 0xcbd5da);
      floorMesh.position.y = baseY;
      floorMesh.userData.floorId = floor.id;
      runtime.floorPickers.push(floorMesh);
      runtime.contentRoot.add(floorMesh);
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
      (equipmentByFloorId[floor.id] ?? []).forEach((equipment) => {
        const object = createEquipmentObject(equipment, { selected: equipment.id === selectedEquipmentId, theme });
        object.position.y += baseY;
        object.userData.floorBaseY = baseY;
        runtime.contentRoot.add(object);
      });
    });
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
    observationPoints.forEach((point) => {
      const target = equipmentMap.get(point.equipmentId);
      if (!target) return;
      const position = new THREE.Vector3(target.equipment.position.x + point.localPosition.x, target.baseY + target.equipment.position.y + point.localPosition.y, target.equipment.position.z + point.localPosition.z);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc14d })); marker.position.copy(position); runtime.helperRoot.add(marker); marker.userData.observationPointId = point.id;
    });
    monitoringDevices.forEach((device) => {
      const geometry = device.sourceType === "CAMERA" ? new THREE.ConeGeometry(0.28, 0.7, 12) : new THREE.SphereGeometry(0.22, 12, 8);
      const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: device.sourceType === "CAMERA" ? 0x4da8ff : 0x4de0a8, wireframe: device.sourceType === "CAMERA" }));
      marker.position.set(device.position.x, device.position.y, device.position.z); marker.rotation.set(device.rotation.x, device.rotation.y, device.rotation.z); runtime.helperRoot.add(marker);
      if (device.sourceType === "CAMERA") {
        const length = Math.max(1, device.range ?? 10); const radius = Math.tan(THREE.MathUtils.degToRad(device.fov ?? 50) / 2) * length;
        const frustum = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0x4da8ff, transparent: true, opacity: 0.09, wireframe: true }));
        frustum.position.set(0, -length / 2, 0); marker.add(frustum);
      }
    });
    monitoringBindings.forEach((binding) => {
      const device = monitoringDevices.find((item) => item.id === binding.sourceDeviceId);
      const point = observationPoints.find((item) => item.id === binding.observationPointId);
      const target = point ? equipmentMap.get(point.equipmentId) : null;
      if (!device || !point || !target) return;
      const targetPosition = new THREE.Vector3(target.equipment.position.x + point.localPosition.x, target.baseY + target.equipment.position.y + point.localPosition.y, target.equipment.position.z + point.localPosition.z);
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(device.position.x, device.position.y, device.position.z), targetPosition]);
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
  }, [building, currentFloor, editMode, equipmentByFloorId, floors, monitoringBindings, monitoringDevices, monitoringMode, observationPoints, selectedEquipmentId, selectedStructureId, floorPlansById, theme, verticalStructures, viewScope]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.transformTools = transformTools;
    configureDualTransformControls(runtime.transformControls, monitoringMode ? { translate: false, rotate: false } : transformTools, {
      camera: runtime.camera,
      allowVerticalTranslation: editMode === "EQUIPMENT",
    });
  }, [editMode, monitoringMode, transformTools]);

  return <section className={styles.viewport} aria-label="3D 공간 보기"><div ref={containerRef} className={styles.canvasMount} /><div className={styles.context}><strong>{building?.name}</strong><span>{viewScope === "BUILDING" ? "전체 건축물" : currentFloor?.name} · 3D 공간 보기</span></div>{externalStatus ? <div className={styles.status}>{externalStatus}</div> : null}</section>;
}
