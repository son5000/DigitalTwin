import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { getBuildingFootprint } from "@/features/digitalTwin/editor/utils/buildingFootprint";
import { getVerticalStructureOpeningForFloor } from "@/features/digitalTwin/editor/utils/stairStructure";
import { createEquipmentObject, getEquipmentGeometrySignature } from "@/features/digitalTwin/editor/objects/EquipmentFactory";
import { createStairPlanObject } from "@/features/digitalTwin/editor/world/StairFactory";
import {
  createWorldStructureObject,
  getWorldStructureDimensions,
  getWorldStructureSignature,
} from "@/features/digitalTwin/editor/world/WorldStructureFactory";

import { disposeObject3D } from "./disposeObject3D";
import { createFloorPlacementPreview } from "./floorPlacementPreview";
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
import styles from "./FloorPlanScene.module.css";

const PLAN_COLORS = {
  light: { background: 0xe8eef1, floor: 0xcbd5da, floorEdge: 0x45616d, grid: 0x8097a2, opening: 0x18232a },
  dark: { background: 0x0c171d, floor: 0x26363d, floorEdge: 0x80a6b4, grid: 0x3f5c68, opening: 0x071015 },
};

function getPointer(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
}

function getStructureId(object, root) {
  let current = object;
  while (current && current !== root) {
    if (current.userData.worldStructureId) return current.userData.worldStructureId;
    current = current.parent;
  }
  return null;
}

function getEquipmentId(object, root) {
  let current = object;
  while (current && current !== root) {
    if (current.userData.equipmentId) return current.userData.equipmentId;
    current = current.parent;
  }
  return null;
}

function addRectangularPath(path, opening) {
  const halfWidth = opening.width / 2;
  const halfDepth = opening.depth / 2;
  const cosine = Math.cos(opening.rotation);
  const sine = Math.sin(opening.rotation);
  const points = [
    [-halfWidth, -halfDepth], [-halfWidth, halfDepth], [halfWidth, halfDepth], [halfWidth, -halfDepth],
  ].map(([x, z]) => ({
    x: opening.x + x * cosine - z * sine,
    z: opening.z + x * sine + z * cosine,
  }));
  path.moveTo(points[0].x, points[0].z);
  points.slice(1).forEach((point) => path.lineTo(point.x, point.z));
  path.closePath();
}

function createFloorSurface(footprint, openings, colors, floorStyle) {
  const shape = new THREE.Shape();
  shape.moveTo(footprint.points[0].x, footprint.points[0].z);
  footprint.points.slice(1).forEach((point) => shape.lineTo(point.x, point.z));
  shape.closePath();
  openings.forEach((opening) => {
    const hole = new THREE.Path();
    addRectangularPath(hole, opening);
    shape.holes.push(hole);
  });
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, createFloorSurfaceMaterial(floorStyle, footprint));
  mesh.name = "DERIVED_LOCKED_FLOOR";
  mesh.userData.isDerivedFloor = true;
  mesh.userData.locked = true;
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: colors.floorEdge, transparent: true, opacity: 0.9 }),
  );
  edge.position.y = 0.012;
  mesh.add(edge);
  return mesh;
}

function subtractIntervals(intervals, cutStart, cutEnd) {
  return intervals.flatMap(([start, end]) => {
    if (cutEnd <= start || cutStart >= end) return [[start, end]];
    const next = [];
    if (cutStart > start) next.push([start, cutStart]);
    if (cutEnd < end) next.push([cutEnd, end]);
    return next;
  });
}

function createBoundedGrid(footprint, openings, cellSize, color) {
  const vertices = [];
  const halfWidth = footprint.width / 2;
  const halfDepth = footprint.depth / 2;
  const spacing = Math.max(0.1, Number(cellSize) || 1);
  const openingBounds = openings.map((opening) => {
    const cosine = Math.abs(Math.cos(opening.rotation));
    const sine = Math.abs(Math.sin(opening.rotation));
    return {
      ...opening,
      width: opening.width * cosine + opening.depth * sine,
      depth: opening.width * sine + opening.depth * cosine,
    };
  });
  const xStart = Math.ceil(-halfWidth / spacing) * spacing;
  const zStart = Math.ceil(-halfDepth / spacing) * spacing;
  for (let x = xStart; x <= halfWidth + 0.0001; x += spacing) {
    let intervals = [[-halfDepth, halfDepth]];
    openingBounds.filter((opening) => Math.abs(x - opening.x) < opening.width / 2)
      .forEach((opening) => { intervals = subtractIntervals(intervals, opening.z - opening.depth / 2, opening.z + opening.depth / 2); });
    intervals.forEach(([start, end]) => vertices.push(x, 0.022, start, x, 0.022, end));
  }
  for (let z = zStart; z <= halfDepth + 0.0001; z += spacing) {
    let intervals = [[-halfWidth, halfWidth]];
    openingBounds.filter((opening) => Math.abs(z - opening.z) < opening.depth / 2)
      .forEach((opening) => { intervals = subtractIntervals(intervals, opening.x - opening.width / 2, opening.x + opening.width / 2); });
    intervals.forEach(([start, end]) => vertices.push(start, 0.022, z, end, 0.022, z));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }));
}

function resizeRuntime(runtime, footprint) {
  const { width, height } = runtime.container.getBoundingClientRect();
  if (!width || !height) return;
  runtime.renderer.setSize(width, height, false);
  const aspect = width / height;
  const contentWidth = footprint.width * 1.14;
  const contentDepth = footprint.depth * 1.14;
  const viewHeight = Math.max(contentDepth, contentWidth / aspect);
  runtime.camera.left = -viewHeight * aspect / 2;
  runtime.camera.right = viewHeight * aspect / 2;
  runtime.camera.top = viewHeight / 2;
  runtime.camera.bottom = -viewHeight / 2;
  runtime.camera.updateProjectionMatrix();
}

function clampToFootprint(position, structure, footprint, cellSize, snap = true) {
  const dimensions = getWorldStructureDimensions(structure);
  const rotation = structure.rotation?.y ?? 0;
  const halfWidth = (Math.abs(Math.cos(rotation)) * dimensions.width + Math.abs(Math.sin(rotation)) * dimensions.depth) / 2;
  const halfDepth = (Math.abs(Math.sin(rotation)) * dimensions.width + Math.abs(Math.cos(rotation)) * dimensions.depth) / 2;
  const spacing = Math.max(0.1, Number(cellSize) || 1);
  const xLimit = Math.max(0, footprint.width / 2 - halfWidth);
  const zLimit = Math.max(0, footprint.depth / 2 - halfDepth);
  return {
    x: THREE.MathUtils.clamp(snap ? Math.round(position.x / spacing) * spacing : position.x, -xLimit, xLimit),
    y: 0,
    z: THREE.MathUtils.clamp(snap ? Math.round(position.z / spacing) * spacing : position.z, -zLimit, zLimit),
  };
}

export default function FloorPlanScene({
  building,
  floor,
  floors = [],
  structures,
  verticalStructures,
  selectedStructureId,
  activeTemplateId,
  transformTools,
  gridSettings,
  theme,
  showFloorReference,
  referenceFloorStructures = [],
  referenceFloorName = "",
  buildingVerticalStructureCount = 0,
  floorStyle,
  onAdd,
  onSelect,
  onTransform,
  editMode = "PLAN",
  equipmentInstances = [],
  equipmentTranslucent = true,
  selectedEquipmentId,
  activeEquipmentTemplateId,
  onEquipmentAdd,
  onEquipmentSelect,
  onEquipmentTransform,
  onCancelPlacement,
  externalStatus = "",
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const handlersRef = useRef({ onAdd, onSelect, onTransform, onEquipmentAdd, onEquipmentSelect, onEquipmentTransform, onCancelPlacement });
  const activeTemplateRef = useRef(activeTemplateId);
  const structuresRef = useRef(structures);
  const equipmentRef = useRef(equipmentInstances);
  const editModeRef = useRef(editMode);
  const activeEquipmentTemplateRef = useRef(activeEquipmentTemplateId);
  const footprint = useMemo(() => getBuildingFootprint(building), [building]);
  const footprintRef = useRef(footprint);
  const gridSizeRef = useRef(gridSettings.baseSize);
  const openings = useMemo(() => verticalStructures
    .map((structure) => getVerticalStructureOpeningForFloor(
      structure,
      floors,
      floor?.id,
      getWorldStructureDimensions(structure),
    ))
    .filter(Boolean), [floor?.id, floors, verticalStructures]);
  const [status, setStatus] = useState("");

  useEffect(() => { handlersRef.current = { onAdd, onSelect, onTransform, onEquipmentAdd, onEquipmentSelect, onEquipmentTransform, onCancelPlacement }; }, [onAdd, onCancelPlacement, onEquipmentAdd, onEquipmentSelect, onEquipmentTransform, onSelect, onTransform]);
  useEffect(() => { activeTemplateRef.current = activeTemplateId; }, [activeTemplateId]);
  useEffect(() => { structuresRef.current = structures; }, [structures]);
  useEffect(() => { equipmentRef.current = equipmentInstances; }, [equipmentInstances]);
  useEffect(() => { editModeRef.current = editMode; activeEquipmentTemplateRef.current = activeEquipmentTemplateId; }, [activeEquipmentTemplateId, editMode]);
  useEffect(() => { footprintRef.current = footprint; gridSizeRef.current = gridSettings.baseSize; }, [footprint, gridSettings.baseSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const colors = PLAN_COLORS[theme];
    const sceneTheme = SCENE_THEMES[theme];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.background);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "현재 층 footprint 안에서 평면 도면을 편집하는 화면");
    renderer.domElement.setAttribute("role", "application");
    container.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 240);
    camera.position.set(0, 80, 0.001);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(0, 0, 0);
    orbitControls.enableRotate = false;
    orbitControls.enablePan = true;
    orbitControls.enableZoom = true;
    orbitControls.screenSpacePanning = true;
    orbitControls.zoomToCursor = true;
    orbitControls.update();

    const transformControls = createDualTransformControls(camera, renderer.domElement, scene);

    const floorRoot = new THREE.Group();
    const structureRoot = new THREE.Group();
    const equipmentRoot = new THREE.Group();
    const placementRoot = new THREE.Group();
    const referenceRoot = new THREE.Group();
    scene.add(floorRoot, referenceRoot, structureRoot, equipmentRoot, placementRoot);
    scene.add(new THREE.HemisphereLight(sceneTheme.hemisphereSky, sceneTheme.hemisphereGround, 2.2));
    const keyLight = new THREE.DirectionalLight(sceneTheme.keyLight, 1.6);
    keyLight.position.set(18, 50, 12);
    scene.add(keyLight);

    const runtime = {
      container, scene, renderer, camera, orbitControls, transformControls, transformTools: { translate: false, rotate: false },
      floorRoot, structureRoot, equipmentRoot, referenceRoot, placementRoot, placementPreview: null,
      structureObjects: new Map(), equipmentObjects: new Map(), floorSurface: null,
    };
    runtimeRef.current = runtime;
    const raycaster = new THREE.Raycaster();
    const pointerStart = new THREE.Vector2();

    function handlePointerDown(event) { pointerStart.set(event.clientX, event.clientY); }
    function getActivePlacementTemplate() {
      return editModeRef.current === "EQUIPMENT" ? activeEquipmentTemplateRef.current : activeTemplateRef.current;
    }
    function updatePlacementPreview(event) {
      const templateId = getActivePlacementTemplate();
      const preview = runtime.placementPreview;
      if (!templateId || !preview || !runtime.floorSurface) {
        if (preview) preview.visible = false;
        return null;
      }
      raycaster.setFromCamera(getPointer(event, renderer.domElement), camera);
      const [floorHit] = raycaster.intersectObject(runtime.floorSurface, false);
      if (!floorHit) {
        preview.visible = false;
        return null;
      }
      const spacing = Math.max(0.1, Number(gridSizeRef.current) || 1);
      preview.position.set(
        Math.round(floorHit.point.x / spacing) * spacing,
        0.04,
        Math.round(floorHit.point.z / spacing) * spacing,
      );
      const bounds = new THREE.Box3().setFromObject(preview);
      const size = bounds.getSize(new THREE.Vector3());
      const xLimit = Math.max(0, footprintRef.current.width / 2 - size.x / 2);
      const zLimit = Math.max(0, footprintRef.current.depth / 2 - size.z / 2);
      preview.position.x = THREE.MathUtils.clamp(preview.position.x, -xLimit, xLimit);
      preview.position.z = THREE.MathUtils.clamp(preview.position.z, -zLimit, zLimit);
      preview.visible = true;
      return { x: preview.position.x, y: 0, z: preview.position.z };
    }
    function handlePointerUp(event) {
      if (event.button !== 0 || dualTransformIsActive(transformControls) || pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;
      raycaster.setFromCamera(getPointer(event, renderer.domElement), camera);
      const placementTemplateId = getActivePlacementTemplate();
      if (placementTemplateId) {
        const position = updatePlacementPreview(event);
        if (!position) {
          handlersRef.current.onCancelPlacement?.();
          setStatus("footprint 밖에서는 배치할 수 없습니다.");
          return;
        }
        if (editModeRef.current === "EQUIPMENT") {
          const ids = handlersRef.current.onEquipmentAdd?.(placementTemplateId, position);
          setStatus(ids?.length ? `설비 ${ids.length}개를 배치했습니다.` : "현재 층에 설비를 배치하지 못했습니다.");
        } else {
          const createdId = handlersRef.current.onAdd(placementTemplateId, position);
          setStatus(createdId ? "구조물을 배치했습니다." : "현재 건축물과 층을 확인하세요.");
        }
        return;
      }
      const [equipmentHit] = raycaster.intersectObjects(equipmentRoot.children, true);
      if (equipmentHit && editModeRef.current === "EQUIPMENT") {
        handlersRef.current.onEquipmentSelect?.(getEquipmentId(equipmentHit.object, equipmentRoot));
        return;
      }
      const [structureHit] = raycaster.intersectObjects(structureRoot.children, true);
      if (structureHit && editModeRef.current === "PLAN") {
        handlersRef.current.onSelect(getStructureId(structureHit.object, structureRoot));
        return;
      }
      handlersRef.current.onSelect(null);
      handlersRef.current.onEquipmentSelect?.(null);
    }
    function previewObjectChange(activeControl) {
      const object = activeControl.object;
      if (!object || activeControl !== transformControls.translate) return;
      const equipment = equipmentRef.current.find((item) => item.id === object?.userData.equipmentId);
      if (equipment) {
        const position = clampToFootprint(object.position, { ...equipment, parameters: equipment.dimensions, type: "CUSTOM_STRUCTURE" }, footprintRef.current, gridSizeRef.current, false);
        object.position.set(position.x, Math.max(0, object.position.y), position.z);
        return;
      }
      const structure = structuresRef.current.find((item) => item.id === object?.userData.worldStructureId);
      if (!structure) return;
      const position = clampToFootprint(object.position, structure, footprintRef.current, gridSizeRef.current, false);
      object.position.set(position.x, 0, position.z);
    }
    function commitObjectChange(activeControl) {
      const object = activeControl.object;
      if (!object) return;
      const equipment = equipmentRef.current.find((item) => item.id === object?.userData.equipmentId);
      if (equipment) {
        const position = clampToFootprint(object.position, { ...equipment, parameters: equipment.dimensions, type: "CUSTOM_STRUCTURE" }, footprintRef.current, gridSizeRef.current);
        object.position.set(position.x, Math.max(0, object.position.y), position.z);
        handlersRef.current.onEquipmentTransform?.(equipment.id, { position: { ...position, y: Math.max(0, object.position.y) }, rotation: { x: 0, y: object.rotation.y, z: 0 } });
        return;
      }
      const structure = structuresRef.current.find((item) => item.id === object?.userData.worldStructureId);
      if (!structure) return;
      const position = clampToFootprint(object.position, structure, footprintRef.current, gridSizeRef.current);
      object.position.set(position.x, 0, position.z);
      const applied = handlersRef.current.onTransform(structure.id, {
        position,
        rotation: { x: 0, y: object.rotation.y, z: 0 },
      });
      if (applied === false) {
        object.position.set(structure.position.x, 0, structure.position.z);
        object.rotation.set(0, structure.rotation?.y ?? 0, 0);
      }
    }
    function handleDraggingChanged(activeControl, event) {
      orbitControls.enabled = !event.value;
      setDualTransformDragging(transformControls, activeControl, event.value, runtime.transformTools);
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", updatePlacementPreview);
    const handlePointerLeave = () => { if (runtime.placementPreview) runtime.placementPreview.visible = false; };
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
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
    const resizeObserver = new ResizeObserver(() => resizeRuntime(runtime, footprintRef.current));
    resizeObserver.observe(container);
    resizeRuntime(runtime, footprintRef.current);

    let frameId;
    function render() {
      orbitControls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }
    render();
    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", updatePlacementPreview);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      transformControls.translate.removeEventListener("objectChange", handleTranslateChange);
      transformControls.rotate.removeEventListener("objectChange", handleRotateChange);
      transformControls.translate.removeEventListener("mouseUp", handleTranslateCommit);
      transformControls.rotate.removeEventListener("mouseUp", handleRotateCommit);
      transformControls.translate.removeEventListener("dragging-changed", handleTranslateDragging);
      transformControls.rotate.removeEventListener("dragging-changed", handleRotateDragging);
      disposeDualTransformControls(transformControls);
      orbitControls.dispose();
      disposeObject3D(floorRoot);
      disposeObject3D(structureRoot);
      disposeObject3D(equipmentRoot);
      disposeObject3D(placementRoot);
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
    const templateId = editMode === "EQUIPMENT" ? activeEquipmentTemplateId : activeTemplateId;
    if (!templateId) return undefined;
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
  }, [activeEquipmentTemplateId, activeTemplateId, editMode, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    disposeObject3D(runtime.floorRoot);
    runtime.scene.remove(runtime.floorRoot);
    runtime.floorRoot = new THREE.Group();
    runtime.scene.add(runtime.floorRoot);
    const colors = PLAN_COLORS[theme];
    const surface = createFloorSurface(footprint, openings, colors, floorStyle);
    runtime.floorSurface = surface;
    runtime.floorRoot.add(surface, createBoundedGrid(footprint, openings, gridSettings.baseSize, colors.grid));
    resizeRuntime(runtime, footprint);
  }, [floorStyle, footprint, gridSettings.baseSize, openings, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    disposeObject3D(runtime.referenceRoot);
    runtime.scene.remove(runtime.referenceRoot);
    runtime.referenceRoot = new THREE.Group();
    runtime.referenceRoot.position.y = 0.04;
    runtime.scene.add(runtime.referenceRoot);
    if (!showFloorReference) return;
    referenceFloorStructures.forEach((structure) => {
      const reference = createWorldStructureObject({
        ...structure,
        locked: true,
        appearance: { ...structure.appearance, opacity: Math.min(0.14, structure.appearance?.opacity ?? 0.14) },
      }, { selected: false, theme, sceneTheme: SCENE_THEMES[theme] });
      reference.traverse((child) => {
        if (child.material) {
          child.material.transparent = true;
          child.material.opacity = Math.min(0.16, child.material.opacity ?? 0.16);
          child.material.depthWrite = false;
        }
      });
      runtime.referenceRoot.add(reference);
    });
  }, [referenceFloorStructures, showFloorReference, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const expectedIds = new Set(structures.map((structure) => structure.id));
    runtime.structureObjects.forEach((object, id) => {
      if (!expectedIds.has(id)) {
        if (runtime.transformControls.translate.object === object || runtime.transformControls.rotate.object === object) detachDualTransformControls(runtime.transformControls);
        runtime.structureRoot.remove(object);
        disposeObject3D(object);
        runtime.structureObjects.delete(id);
      }
    });
    structures.forEach((structure) => {
      const selected = structure.id === selectedStructureId;
      const signature = structure.type === "STAIR"
        ? `${getWorldStructureSignature(structure, { selected, theme })}|${floor?.id}|${floors.map((item) => `${item.id}:${item.elevation}`).join(",")}`
        : getWorldStructureSignature(structure, { selected, theme });
      let object = runtime.structureObjects.get(structure.id);
      if (!object || object.userData.geometrySignature !== signature) {
        if (object) {
          if (runtime.transformControls.translate.object === object || runtime.transformControls.rotate.object === object) detachDualTransformControls(runtime.transformControls);
          runtime.structureRoot.remove(object);
          disposeObject3D(object);
        }
        object = structure.type === "STAIR"
          ? createStairPlanObject(structure, floors, floor?.id, { selected, sceneTheme: SCENE_THEMES[theme] })
          : createWorldStructureObject(structure, { selected, theme, sceneTheme: SCENE_THEMES[theme] });
        object.userData.geometrySignature = signature;
        if (structure.type !== "STAIR" && verticalStructures.some((item) => item.id === structure.id)) {
          object.traverse((child) => {
            if (!child.material) return;
            child.material.transparent = true;
            child.material.opacity = Math.min(0.22, child.material.opacity ?? 0.22);
            child.material.depthWrite = false;
          });
        }
        runtime.structureObjects.set(structure.id, object);
        runtime.structureRoot.add(object);
      }
      object.position.set(structure.position.x, 0, structure.position.z);
      object.rotation.set(0, structure.rotation.y, 0);
    });
    const selected = runtime.structureObjects.get(selectedStructureId);
    if (editMode === "PLAN") {
      if (selected && !structures.find((item) => item.id === selectedStructureId)?.locked) attachDualTransformControls(runtime.transformControls, selected, runtime.transformTools);
      else detachDualTransformControls(runtime.transformControls);
    }
  }, [editMode, floor?.id, floors, selectedStructureId, structures, theme, verticalStructures]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const expectedIds = new Set(equipmentInstances.map((item) => item.id));
    runtime.equipmentObjects.forEach((object, id) => {
      if (!expectedIds.has(id)) {
        if (runtime.transformControls.translate.object === object || runtime.transformControls.rotate.object === object) detachDualTransformControls(runtime.transformControls);
        runtime.equipmentRoot.remove(object);
        disposeObject3D(object);
        runtime.equipmentObjects.delete(id);
      }
    });
    equipmentInstances.forEach((equipment) => {
      const selected = equipment.id === selectedEquipmentId;
      const signature = getEquipmentGeometrySignature(equipment, {
        selected, colliding: false, dimmed: false, theme, viewerTranslucent: equipmentTranslucent,
      });
      let object = runtime.equipmentObjects.get(equipment.id);
      if (!object || object.userData.geometrySignature !== signature) {
        if (object) { runtime.equipmentRoot.remove(object); disposeObject3D(object); }
        object = createEquipmentObject(equipment, { selected, theme, viewerTranslucent: equipmentTranslucent });
        runtime.equipmentObjects.set(equipment.id, object);
        runtime.equipmentRoot.add(object);
      }
      object.position.set(equipment.position.x, equipment.position.y, equipment.position.z);
      object.rotation.set(equipment.rotation.x, equipment.rotation.y, equipment.rotation.z);
    });
    if (editMode === "EQUIPMENT") {
      const selected = runtime.equipmentObjects.get(selectedEquipmentId);
      if (selected && !equipmentInstances.find((item) => item.id === selectedEquipmentId)?.locked) attachDualTransformControls(runtime.transformControls, selected, runtime.transformTools);
      else detachDualTransformControls(runtime.transformControls);
    }
  }, [editMode, equipmentInstances, equipmentTranslucent, selectedEquipmentId, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.transformTools = transformTools;
    configureDualTransformControls(runtime.transformControls, transformTools);
  }, [transformTools]);

  return (
    <section className={styles.viewport} aria-label="층별 도면 구성 화면">
      <div ref={containerRef} className={styles.canvasMount} />
      <div className={styles.sceneMeta} data-camera-safe-ui>
        <div className={styles.context}><strong>{building?.name ?? "건축물 미선택"}</strong><span>{floor?.name ?? "층 미선택"}</span></div>
        <div className={styles.mode}>{footprint.width.toFixed(1)} × {footprint.depth.toFixed(1)} m · 연결 {buildingVerticalStructureCount}</div>
        <div className={styles.legend}><span className={styles.floorKey} /> 바닥 <span className={styles.openingKey} /> 개구부</div>
      </div>
      {showFloorReference ? <div className={styles.reference}>{referenceFloorName || "선택층"} 도면 참조선 표시</div> : null}
      {externalStatus || status ? <div className={styles.status}>{externalStatus || status}</div> : null}
    </section>
  );
}
