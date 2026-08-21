import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import {
  createEquipmentObject,
  getEquipmentGeometrySignature,
} from "@/features/digitalTwin/editor/objects/EquipmentFactory";
import {
  DEFAULT_WORLD,
  TRANSFORM_MODES,
  VIEW_MODES,
} from "@/features/digitalTwin/editor/constants/equipmentShapeTemplates";
import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { EDITOR_MODES } from "@/features/digitalTwin/editor/constants/worldStructureTemplates";
import { createBaseWorld } from "@/features/digitalTwin/editor/world/createBaseWorld";
import {
  createWorldStructureObject,
  getWorldStructureSignature,
} from "@/features/digitalTwin/editor/world/WorldStructureFactory";
import { getEquipmentConnectionPoints } from "@/features/digitalTwin/editor/utils/pipeConnections";

import { disposeObject3D } from "./disposeObject3D";
import styles from "./DigitalTwinScene.module.css";

function configureTransformControls(transformControls, transformMode, allowVertical = false) {
  transformControls.setMode(transformMode);
  transformControls.showX = transformMode === TRANSFORM_MODES.TRANSLATE;
  transformControls.showY = transformMode === TRANSFORM_MODES.ROTATE || allowVertical;
  transformControls.showZ = transformMode === TRANSFORM_MODES.TRANSLATE;
}

function applySceneTheme(runtime, sceneTheme) {
  runtime.scene.background.set(sceneTheme.background);
  runtime.scene.fog.color.set(sceneTheme.fog);
  runtime.hemisphereLight.color.set(sceneTheme.hemisphereSky);
  runtime.hemisphereLight.groundColor.set(sceneTheme.hemisphereGround);
  runtime.keyLight.color.set(sceneTheme.keyLight);
  runtime.fillLight.color.set(sceneTheme.fillLight);
}

function resizeRuntime(runtime) {
  const { width, height } = runtime.container.getBoundingClientRect();

  if (!width || !height) {
    return;
  }

  const aspect = width / height;
  runtime.renderer.setSize(width, height, false);
  runtime.perspectiveCamera.aspect = aspect;
  runtime.perspectiveCamera.updateProjectionMatrix();

  const frustumHeight = Math.max(
    runtime.world.depth + 4,
    (runtime.world.width + 4) / aspect,
  );
  runtime.orthographicCamera.left = (-frustumHeight * aspect) / 2;
  runtime.orthographicCamera.right = (frustumHeight * aspect) / 2;
  runtime.orthographicCamera.top = frustumHeight / 2;
  runtime.orthographicCamera.bottom = -frustumHeight / 2;
  runtime.orthographicCamera.updateProjectionMatrix();
}

function getPointer(event, canvas) {
  const bounds = canvas.getBoundingClientRect();

  return new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
}

function findSceneObjectData(object, root) {
  let currentObject = object;

  while (currentObject && currentObject !== root) {
    if (currentObject.userData.equipmentId) {
      return { domain: "EQUIPMENT", id: currentObject.userData.equipmentId };
    }

    if (currentObject.userData.worldStructureId) {
      return { domain: "WORLD", id: currentObject.userData.worldStructureId };
    }

    currentObject = currentObject.parent;
  }

  return null;
}

function isVisibilityEnabled(object, visibilityFilters) {
  return visibilityFilters[object.userData.visibilityType ?? "OTHER"] !== false;
}

export default function DigitalTwinScene({
  world,
  editorMode,
  worldStructures,
  equipmentInstances,
  selectedWorldStructureId,
  selectedEquipmentId,
  activeWorldTemplateId,
  activeTemplateId,
  worldStructuresLocked,
  visibilityFilters,
  theme,
  viewMode,
  transformMode,
  snapSize,
  collisionIds,
  pipeConnections,
  pipeSnapCandidate,
  onEquipmentAdd,
  onEquipmentSelect,
  onEquipmentTransform,
  onEquipmentTransformEnd,
  onWorldStructureAdd,
  onWorldStructureSelect,
  onWorldStructureTransform,
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const activeTemplateRef = useRef(activeTemplateId);
  const activeWorldTemplateRef = useRef(activeWorldTemplateId);
  const editorModeRef = useRef(editorMode);
  const [hoverInfo, setHoverInfo] = useState(null);
  const handlersRef = useRef({
    onEquipmentAdd,
    onEquipmentSelect,
    onEquipmentTransform,
    onEquipmentTransformEnd,
    onWorldStructureAdd,
    onWorldStructureSelect,
    onWorldStructureTransform,
  });

  useEffect(() => {
    handlersRef.current = {
      onEquipmentAdd,
      onEquipmentSelect,
      onEquipmentTransform,
      onEquipmentTransformEnd,
      onWorldStructureAdd,
      onWorldStructureSelect,
      onWorldStructureTransform,
    };
  }, [onEquipmentAdd, onEquipmentSelect, onEquipmentTransform, onEquipmentTransformEnd, onWorldStructureAdd, onWorldStructureSelect, onWorldStructureTransform]);

  useEffect(() => {
    activeTemplateRef.current = activeTemplateId;

    if (runtimeRef.current) {
      runtimeRef.current.renderer.domElement.style.cursor = activeTemplateId
        ? "crosshair"
        : "default";
    }
  }, [activeTemplateId]);

  useEffect(() => {
    activeWorldTemplateRef.current = activeWorldTemplateId;
    editorModeRef.current = editorMode;

    if (runtimeRef.current) {
      runtimeRef.current.renderer.domElement.style.cursor = activeWorldTemplateId
        ? "crosshair"
        : editorMode === EDITOR_MODES.EQUIPMENT
          ? "move"
          : "default";
    }
  }, [activeWorldTemplateId, editorMode]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const initialSceneTheme = SCENE_THEMES.dark;
    scene.background = new THREE.Color(initialSceneTheme.background);
    scene.fog = new THREE.FogExp2(initialSceneTheme.fog, 0.018);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Digital Twin 3D 편집 화면");
    renderer.domElement.setAttribute("role", "application");
    container.appendChild(renderer.domElement);

    const perspectiveCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 250);
    perspectiveCamera.position.set(13, 12, 15);

    const orthographicCamera = new THREE.OrthographicCamera(-12, 12, 10, -10, 0.1, 250);
    orthographicCamera.position.set(0, 35, 0);
    orthographicCamera.up.set(0, 0, -1);
    orthographicCamera.lookAt(0, 0, 0);

    const orbitControls = new OrbitControls(perspectiveCamera, renderer.domElement);
    orbitControls.target.set(0, 0.8, 0);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.minDistance = 3;
    orbitControls.maxDistance = 70;
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.02;
    orbitControls.touches.ONE = THREE.TOUCH.ROTATE;
    orbitControls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    orbitControls.update();

    const transformControls = new TransformControls(
      perspectiveCamera,
      renderer.domElement,
    );
    transformControls.setMode(TRANSFORM_MODES.TRANSLATE);
    transformControls.setTranslationSnap(0.1);
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
    transformControls.showY = false;

    const worldRoot = new THREE.Group();
    worldRoot.name = "WorldGroup";
    scene.add(worldRoot);

    const worldStructureRoot = new THREE.Group();
    worldStructureRoot.name = "WorldStructures";
    worldRoot.add(worldStructureRoot);

    const equipmentRoot = new THREE.Group();
    equipmentRoot.name = "EquipmentGroup";
    scene.add(equipmentRoot);

    const overlayRoot = new THREE.Group();
    overlayRoot.name = "OverlayGroup";
    scene.add(overlayRoot);
    overlayRoot.add(transformControls.getHelper());

    const connectionMarkerRoot = new THREE.Group();
    connectionMarkerRoot.name = "PipeConnectionMarkers";
    overlayRoot.add(connectionMarkerRoot);

    const hemisphereLight = new THREE.HemisphereLight(
      initialSceneTheme.hemisphereSky,
      initialSceneTheme.hemisphereGround,
      1.9,
    );
    scene.add(hemisphereLight);
    const keyLight = new THREE.DirectionalLight(initialSceneTheme.keyLight, 2.2);
    keyLight.position.set(8, 14, 10);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(
      initialSceneTheme.fillLight,
      0.8,
    );
    fillLight.position.set(-10, 6, -8);
    scene.add(fillLight);

    const runtime = {
      container,
      scene,
      renderer,
      perspectiveCamera,
      orthographicCamera,
      activeCamera: perspectiveCamera,
      orbitControls,
      transformControls,
      hemisphereLight,
      keyLight,
      fillLight,
      worldRoot,
      worldStructureRoot,
      equipmentRoot,
      overlayRoot,
      connectionMarkerRoot,
      equipmentObjects: new Map(),
      worldStructureObjects: new Map(),
      baseWorldRoot: null,
      floor: null,
      world: DEFAULT_WORLD,
    };
    runtimeRef.current = runtime;

    const raycaster = new THREE.Raycaster();
    const pointerStart = new THREE.Vector2();

    function handlePointerDown(event) {
      pointerStart.set(event.clientX, event.clientY);
    }

    function handlePointerUp(event) {
      if (event.button !== 0 || pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) {
        return;
      }

      if (transformControls.axis) {
        return;
      }

      raycaster.setFromCamera(
        getPointer(event, renderer.domElement),
        runtime.activeCamera,
      );

      if (
        editorModeRef.current === EDITOR_MODES.EQUIPMENT &&
        activeTemplateRef.current &&
        runtime.floor
      ) {
        const [floorIntersection] = raycaster.intersectObject(runtime.floor, false);

        if (floorIntersection) {
          handlersRef.current.onEquipmentAdd(
            activeTemplateRef.current,
            floorIntersection.point,
          );
        }

        return;
      }

      if (
        editorModeRef.current === EDITOR_MODES.WORLD &&
        activeWorldTemplateRef.current &&
        runtime.floor
      ) {
        const [floorIntersection] = raycaster.intersectObject(runtime.floor, false);

        if (floorIntersection) {
          handlersRef.current.onWorldStructureAdd(
            activeWorldTemplateRef.current,
            floorIntersection.point,
          );
        }

        return;
      }

      if (editorModeRef.current === EDITOR_MODES.VIEWER) return;
      const selectionRoot = editorModeRef.current === EDITOR_MODES.WORLD
        ? runtime.worldStructureRoot
        : runtime.equipmentRoot;
      const intersections = raycaster.intersectObjects(
        selectionRoot.children,
        true,
      );
      const sceneObject = intersections.length
        ? findSceneObjectData(intersections[0].object, selectionRoot)
        : null;
      if (editorModeRef.current === EDITOR_MODES.WORLD) {
        handlersRef.current.onWorldStructureSelect(sceneObject?.id ?? null);
      } else {
        handlersRef.current.onEquipmentSelect(sceneObject?.id ?? null);
      }
    }

    function handlePointerMove(event) {
      if (activeTemplateRef.current || activeWorldTemplateRef.current) {
        setHoverInfo(null);
        return;
      }

      raycaster.setFromCamera(getPointer(event, renderer.domElement), runtime.activeCamera);
      const roots = editorModeRef.current === EDITOR_MODES.WORLD
        ? [runtime.worldStructureRoot]
        : editorModeRef.current === EDITOR_MODES.EQUIPMENT
          ? [runtime.equipmentRoot]
          : [runtime.worldStructureRoot, runtime.equipmentRoot];
      const [intersection] = raycaster.intersectObjects(roots, true);
      const data = intersection
        ? findSceneObjectData(intersection.object, scene)
        : null;
      const source = data?.domain === "WORLD"
        ? runtime.worldStructureObjects.get(data.id)
        : runtime.equipmentObjects.get(data?.id);
      setHoverInfo(data && source ? {
        domain: data.domain === "WORLD" ? "World Structure" : "Equipment",
        name: source.name,
        x: event.clientX,
        y: event.clientY,
      } : null);
    }

    function handleDraggingChanged(event) {
      orbitControls.enabled = !event.value;

      if (!event.value && transformControls.object) {
        const equipmentId = transformControls.object.userData.equipmentId;
        if (equipmentId) {
          requestAnimationFrame(() => handlersRef.current.onEquipmentTransformEnd(equipmentId));
        }
      }
    }

    function handleObjectChange() {
      const equipmentObject = transformControls.object;

      if (!equipmentObject) {
        return;
      }

      const isWorldStructure = equipmentObject.userData.domain === "WORLD";
      const transformHandler = isWorldStructure
        ? handlersRef.current.onWorldStructureTransform
        : handlersRef.current.onEquipmentTransform;
      const objectId = isWorldStructure
        ? equipmentObject.userData.worldStructureId
        : equipmentObject.userData.equipmentId;
      transformHandler(
        objectId,
        {
          position: {
            x: equipmentObject.position.x,
            y: equipmentObject.position.y,
            z: equipmentObject.position.z,
          },
          rotation: {
            x: equipmentObject.rotation.x,
            y: equipmentObject.rotation.y,
            z: equipmentObject.rotation.z,
          },
        },
      );
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", () => setHoverInfo(null));
    transformControls.addEventListener("dragging-changed", handleDraggingChanged);
    transformControls.addEventListener("objectChange", handleObjectChange);

    const resizeObserver = new ResizeObserver(() => resizeRuntime(runtime));
    resizeObserver.observe(container);
    resizeRuntime(runtime);

    let animationFrameId;
    function renderFrame() {
      orbitControls.update();
      renderer.render(scene, runtime.activeCamera);
      animationFrameId = requestAnimationFrame(renderFrame);
    }
    renderFrame();

    return () => {
      runtimeRef.current = null;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      transformControls.removeEventListener(
        "dragging-changed",
        handleDraggingChanged,
      );
      transformControls.removeEventListener("objectChange", handleObjectChange);
      transformControls.detach();
      transformControls.dispose();
      orbitControls.dispose();
      runtime.equipmentObjects.forEach(disposeObject3D);
      runtime.worldStructureObjects.forEach(disposeObject3D);
      disposeObject3D(runtime.connectionMarkerRoot);

      if (runtime.baseWorldRoot) {
        disposeObject3D(runtime.baseWorldRoot);
      }

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (runtime) {
      applySceneTheme(runtime, SCENE_THEMES[theme]);
    }
  }, [theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    if (runtime.baseWorldRoot) {
      runtime.worldRoot.remove(runtime.baseWorldRoot);
      disposeObject3D(runtime.baseWorldRoot);
    }

    const baseWorld = createBaseWorld(world, SCENE_THEMES[theme]);
    runtime.baseWorldRoot = baseWorld.root;
    runtime.floor = baseWorld.floor;
    runtime.world = world;
    runtime.worldRoot.add(baseWorld.root);
    resizeRuntime(runtime);
  }, [theme, world]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    const expectedIds = new Set(worldStructures.map((structure) => structure.id));
    runtime.worldStructureObjects.forEach((object, structureId) => {
      if (!expectedIds.has(structureId)) {
        if (runtime.transformControls.object === object) runtime.transformControls.detach();
        runtime.worldStructureRoot.remove(object);
        disposeObject3D(object);
        runtime.worldStructureObjects.delete(structureId);
      }
    });

    worldStructures.forEach((structure) => {
      const visualState = {
        selected: structure.id === selectedWorldStructureId,
        theme,
        sceneTheme: SCENE_THEMES[theme],
      };
      const signature = getWorldStructureSignature(structure, visualState);
      let object = runtime.worldStructureObjects.get(structure.id);

      if (!object || object.userData.geometrySignature !== signature) {
        if (object) {
          if (runtime.transformControls.object === object) runtime.transformControls.detach();
          runtime.worldStructureRoot.remove(object);
          disposeObject3D(object);
        }
        object = createWorldStructureObject(structure, visualState);
        runtime.worldStructureObjects.set(structure.id, object);
        runtime.worldStructureRoot.add(object);
      }

      object.position.set(structure.position.x, structure.position.y, structure.position.z);
      object.rotation.set(structure.rotation.x, structure.rotation.y, structure.rotation.z);
      object.visible = structure.visible && isVisibilityEnabled(object, visibilityFilters);
    });

    const selectedObject = runtime.worldStructureObjects.get(selectedWorldStructureId);
    const selectedStructure = worldStructures.find((structure) => structure.id === selectedWorldStructureId);
    if (
      editorMode === EDITOR_MODES.WORLD &&
      selectedObject &&
      !selectedStructure?.locked &&
      !worldStructuresLocked
    ) {
      runtime.transformControls.attach(selectedObject);
    } else if (runtime.transformControls.object?.userData.domain === "WORLD") {
      runtime.transformControls.detach();
    }
  }, [editorMode, selectedWorldStructureId, theme, visibilityFilters, worldStructures, worldStructuresLocked]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    const expectedIds = new Set(
      equipmentInstances.map((equipment) => equipment.id),
    );

    runtime.equipmentObjects.forEach((object, equipmentId) => {
      if (!expectedIds.has(equipmentId)) {
        if (runtime.transformControls.object === object) {
          runtime.transformControls.detach();
        }

        runtime.equipmentRoot.remove(object);
        disposeObject3D(object);
        runtime.equipmentObjects.delete(equipmentId);
      }
    });

    equipmentInstances.forEach((equipment) => {
      const visualState = {
        selected: equipment.id === selectedEquipmentId,
        colliding: collisionIds.has(equipment.id),
        dimmed: editorMode === EDITOR_MODES.WORLD,
        theme,
      };
      const signature = getEquipmentGeometrySignature(equipment, visualState);
      let equipmentObject = runtime.equipmentObjects.get(equipment.id);

      if (
        !equipmentObject ||
        equipmentObject.userData.geometrySignature !== signature
      ) {
        if (equipmentObject) {
          if (runtime.transformControls.object === equipmentObject) {
            runtime.transformControls.detach();
          }

          runtime.equipmentRoot.remove(equipmentObject);
          disposeObject3D(equipmentObject);
        }

        equipmentObject = createEquipmentObject(equipment, visualState);
        runtime.equipmentObjects.set(equipment.id, equipmentObject);
        runtime.equipmentRoot.add(equipmentObject);
      }

      equipmentObject.position.set(
        equipment.position.x,
        equipment.position.y,
        equipment.position.z,
      );
      equipmentObject.rotation.set(
        equipment.rotation.x,
        equipment.rotation.y,
        equipment.rotation.z,
      );
    });

    const selectedObject = runtime.equipmentObjects.get(selectedEquipmentId);
    const selectedEquipment = equipmentInstances.find(
      (equipment) => equipment.id === selectedEquipmentId,
    );

    if (
      editorMode === EDITOR_MODES.EQUIPMENT &&
      selectedObject &&
      !selectedEquipment?.locked
    ) {
      runtime.transformControls.attach(selectedObject);
    } else if (runtime.transformControls.object?.userData.domain === "EQUIPMENT") {
      runtime.transformControls.detach();
    }
    runtime.equipmentRoot.visible = visibilityFilters.EQUIPMENT !== false;
  }, [collisionIds, editorMode, equipmentInstances, selectedEquipmentId, theme, visibilityFilters.EQUIPMENT]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime?.baseWorldRoot) return;

    runtime.baseWorldRoot.traverse((object) => {
      if (object.userData.visibilityType) {
        object.visible = visibilityFilters[object.userData.visibilityType] !== false;
      }
    });
  }, [theme, visibilityFilters, world]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    runtime.connectionMarkerRoot.clear();
    const connectedPointKeys = new Set(
      pipeConnections.flatMap((connection) => [
        `${connection.fromEquipmentId}:${connection.fromPointId}`,
        `${connection.toEquipmentId}:${connection.toPointId}`,
      ]),
    );
    const candidatePointKeys = new Set(
      pipeSnapCandidate
        ? [
            `${pipeSnapCandidate.movingPoint.equipmentId}:${pipeSnapCandidate.movingPoint.id}`,
            `${pipeSnapCandidate.targetPoint.equipmentId}:${pipeSnapCandidate.targetPoint.id}`,
          ]
        : [],
    );
    const sceneTheme = SCENE_THEMES[theme];

    equipmentInstances.forEach((equipment) => {
      const points = getEquipmentConnectionPoints(equipment);
      if (!points.length) return;

      points.forEach((point) => {
        const key = `${equipment.id}:${point.id}`;
        const isConnected = connectedPointKeys.has(key);
        const isCandidate = candidatePointKeys.has(key);
        if (equipment.id !== selectedEquipmentId && !isConnected && !isCandidate) return;

        const color = isConnected
          ? sceneTheme.connectionConnected
          : isCandidate
            ? sceneTheme.connectionCandidate
            : sceneTheme.connectionNormal;
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(isCandidate ? 0.1 : 0.075, 14, 10),
          new THREE.MeshBasicMaterial({ color, depthTest: false }),
        );
        marker.position.set(point.x, point.y, point.z);
        marker.renderOrder = 5;
        runtime.connectionMarkerRoot.add(marker);
      });
    });

    return () => {
      runtime.connectionMarkerRoot.children.forEach(disposeObject3D);
      runtime.connectionMarkerRoot.clear();
    };
  }, [equipmentInstances, pipeConnections, pipeSnapCandidate, selectedEquipmentId, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    const is3D = viewMode === VIEW_MODES.VIEW_3D;
    runtime.activeCamera = is3D
      ? runtime.perspectiveCamera
      : runtime.orthographicCamera;
    runtime.orbitControls.object = runtime.activeCamera;
    runtime.orbitControls.enableRotate = is3D;
    runtime.orbitControls.screenSpacePanning = !is3D;
    runtime.orbitControls.touches.ONE = is3D
      ? THREE.TOUCH.ROTATE
      : THREE.TOUCH.PAN;
    runtime.orbitControls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    runtime.orbitControls.target.set(0, is3D ? 0.8 : 0, 0);
    runtime.transformControls.camera = runtime.activeCamera;

    if (!is3D) {
      runtime.orthographicCamera.position.set(0, 35, 0);
      runtime.orthographicCamera.up.set(0, 0, -1);
      runtime.orthographicCamera.lookAt(0, 0, 0);
    }

    resizeRuntime(runtime);
    runtime.orbitControls.update();
  }, [viewMode]);

  useEffect(() => {
    const transformControls = runtimeRef.current?.transformControls;

    if (!transformControls) {
      return;
    }

    configureTransformControls(
      transformControls,
      transformMode,
      editorMode !== EDITOR_MODES.VIEWER && transformMode === TRANSFORM_MODES.TRANSLATE,
    );
  }, [editorMode, transformMode]);

  useEffect(() => {
    runtimeRef.current?.transformControls.setTranslationSnap(snapSize);
  }, [snapSize]);

  return (
    <section className={styles.viewport} aria-label="Digital Twin Scene">
      <div ref={containerRef} className={styles.canvasMount} />
      <div className={styles.sceneStatus}>
        <span className={styles.liveDot} />
        {editorMode === EDITOR_MODES.WORLD
          ? "WORLD EDIT"
          : editorMode === EDITOR_MODES.EQUIPMENT
            ? "EQUIPMENT EDIT"
            : "VIEWER"}
      </div>
      <div className={styles.axisLegend} aria-hidden="true">
        <span className={styles.axisX}>X</span>
        <span className={styles.axisY}>Y</span>
        <span className={styles.axisZ}>Z</span>
        <span>METER</span>
      </div>
      {activeTemplateId && (
        <div className={styles.placementHint}>
          바닥을 클릭하여 설비를 배치하세요 · ESC 취소
        </div>
      )}
      {activeWorldTemplateId && (
        <div className={`${styles.placementHint} ${styles.worldPlacementHint}`}>
          장면의 기준 위치를 클릭하여 World Structure를 배치하세요 · ESC 취소
        </div>
      )}
      {hoverInfo && (
        <div
          className={`${styles.hoverTooltip} ${hoverInfo.domain === "World Structure" ? styles.worldTooltip : styles.equipmentTooltip}`}
          style={{ left: hoverInfo.x + 14, top: hoverInfo.y + 14 }}
        >
          <strong>{hoverInfo.name}</strong>
          <span>{hoverInfo.domain}</span>
        </div>
      )}
    </section>
  );
}
