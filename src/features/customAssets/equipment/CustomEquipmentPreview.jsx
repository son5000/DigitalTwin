import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { SCENE_THEMES } from "@/features/digitalTwin/editor/constants/sceneThemes";
import { disposeObject3D } from "@/features/digitalTwin/editor/three/disposeObject3D";
import { createCustomEquipmentPlacement } from "./customEquipmentModel.js";
import { createCustomEquipmentGroup } from "./customEquipmentRenderer.js";
import styles from "./CustomEquipmentEditor.module.css";

function findPart(root, partId) { return root?.children.find((child) => child.userData.customEquipmentPartId === partId) ?? null; }

function clearGhost(runtime) {
  if (runtime.ghost) { runtime.scene.remove(runtime.ghost); disposeObject3D(runtime.ghost); runtime.ghost = null; }
  runtime.ghostKey = ""; runtime.ghostPartId = null; runtime.placementResult = null;
}

function notifyPlacementState(runtime, state) {
  if (runtime.placementState === state) return;
  runtime.placementState = state; runtime.callbacks.onPlacementState?.(state);
}

export default function CustomEquipmentPreview({ asset, selectedPartId, selectedPartIds = [], selectedPortId, selectedPortRef = null, placementType = null, placementDirectionId = "E", theme, transformMode, focusKey, onSelectPart, onSelectPort, onTransformPart, onPlacePart, onPlacementState }) {
  const hostRef = useRef(null); const runtimeRef = useRef(null); const callbacksRef = useRef({ onSelectPart, onSelectPort, onTransformPart, onPlacePart, onPlacementState }); const framedRef = useRef("");
  useEffect(() => { callbacksRef.current = { onSelectPart, onSelectPort, onTransformPart, onPlacePart, onPlacementState }; if (runtimeRef.current) runtimeRef.current.callbacks = callbacksRef.current; }, [onPlacePart, onPlacementState, onSelectPart, onSelectPort, onTransformPart]);

  useEffect(() => {
    const host = hostRef.current; if (!host) return undefined;
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 2000); camera.position.set(8, 6, 9);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, 0.5, 0);
    const light = new THREE.DirectionalLight(0xffffff, 2.3); light.position.set(8, 14, 10); light.castShadow = true; scene.add(light, new THREE.HemisphereLight(0xbad7e8, 0x27343b, 1.8));
    const grid = new THREE.GridHelper(80, 80, 0x47758a, 0x274653); scene.add(grid);
    const transform = new TransformControls(camera, renderer.domElement); scene.add(transform.getHelper());
    const runtime = { scene, camera, renderer, controls, grid, transform, model: null, ghost: null, ghostKey: "", ghostPartId: null, placementResult: null, placementState: "idle", placementType: null, placementDirectionId: "E", selectedPortRef: null, frame: 0, selectedPartId: null, asset: null, dragging: false, transformMode: "translate", callbacks: callbacksRef.current }; runtimeRef.current = runtime;
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const groundHit = new THREE.Vector3(); let pointerStart = null;
    const updatePlacementGhost = (event) => {
      if (!runtime.placementType || !runtime.asset || !runtime.model) return null;
      const rect = renderer.domElement.getBoundingClientRect(); if (!rect.width || !rect.height) return null;
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(groundPlane, groundHit)) { if (runtime.ghost) runtime.ghost.visible = false; notifyPlacementState(runtime, "hidden"); return null; }
      runtime.model.updateMatrixWorld(true); const localPosition = runtime.model.worldToLocal(groundHit.clone()); const origin = runtime.asset.origin ?? { x: 0, y: 0, z: 0 };
      const result = createCustomEquipmentPlacement(runtime.asset, runtime.placementType, { x: localPosition.x + origin.x, y: localPosition.y + origin.y, z: localPosition.z + origin.z }, { directionId: runtime.placementDirectionId, preferredPortRef: runtime.selectedPortRef });
      const ghostPart = result.asset.parts.find((part) => part.id === result.partId); if (!ghostPart) return null;
      const ghostKey = `${ghostPart.type}:${ghostPart.parameters.diameter}:${ghostPart.parameters.endDiameter ?? ""}`;
      if (!runtime.ghost || runtime.ghostKey !== ghostKey) { clearGhost(runtime); runtime.ghost = createCustomEquipmentGroup({ ...runtime.asset, parts: [ghostPart] }, { previewPartId: ghostPart.id, exposeParts: true, opacity: 0.72 }); runtime.ghostKey = ghostKey; runtime.ghostPartId = ghostPart.id; runtime.scene.add(runtime.ghost); }
      else { const holder = findPart(runtime.ghost, runtime.ghostPartId); if (holder) { holder.position.set(ghostPart.position.x - origin.x, ghostPart.position.y - origin.y, ghostPart.position.z - origin.z); holder.rotation.set(ghostPart.rotation.x, ghostPart.rotation.y, ghostPart.rotation.z); } }
      runtime.ghost.visible = true; runtime.placementResult = result; notifyPlacementState(runtime, result.snapped ? "snapped" : "ready"); return result;
    };
    const down = (event) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const move = (event) => { if (runtime.placementType && !runtime.dragging) updatePlacementGhost(event); };
    const leave = () => { if (runtime.ghost) runtime.ghost.visible = false; runtime.placementResult = null; notifyPlacementState(runtime, runtime.placementType ? "hidden" : "idle"); };
    const up = (event) => { const moved = !pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 7; pointerStart = null; if (runtime.dragging || moved || !runtime.model) return; if (runtime.placementType) { const result = updatePlacementGhost(event); if (result) runtime.callbacks.onPlacePart?.(result); return; } const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObject(runtime.model, true)[0]; if (!hit) return; let object = hit.object; while (object && !object.userData.customEquipmentPartId) object = object.parent; if (!object) return; if (object.userData.customEquipmentPortId) runtime.callbacks.onSelectPort?.(object.userData.customEquipmentPartId, object.userData.customEquipmentPortId); else runtime.callbacks.onSelectPart?.(object.userData.customEquipmentPartId, { additive: event.ctrlKey || event.metaKey || event.shiftKey }); };
    const dragging = (event) => { runtime.dragging = event.value; controls.enabled = !event.value; };
    const commit = () => { const object = transform.object; if (!object?.userData.customEquipmentPartId || !runtime.asset) return; callbacksRef.current.onTransformPart?.(object.userData.customEquipmentPartId, { position: { x: object.position.x + (runtime.asset.origin?.x ?? 0), y: object.position.y + (runtime.asset.origin?.y ?? 0), z: object.position.z + (runtime.asset.origin?.z ?? 0) }, rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z } }); };
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointerleave", leave); renderer.domElement.addEventListener("pointercancel", leave); transform.addEventListener("dragging-changed", dragging); transform.addEventListener("mouseUp", commit);
    const resize = () => { const { width, height } = host.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const animate = () => { controls.update(); renderer.render(scene, camera); runtime.frame = requestAnimationFrame(animate); }; animate();
    return () => { observer.disconnect(); cancelAnimationFrame(runtime.frame); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.domElement.removeEventListener("pointerleave", leave); renderer.domElement.removeEventListener("pointercancel", leave); transform.removeEventListener("dragging-changed", dragging); transform.removeEventListener("mouseUp", commit); transform.detach(); transform.dispose(); controls.dispose(); clearGhost(runtime); if (runtime.model) disposeObject3D(runtime.model); disposeObject3D(grid); renderer.dispose(); renderer.domElement.remove(); runtimeRef.current = null; };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime) return; runtime.placementType = placementType; runtime.placementDirectionId = placementDirectionId; runtime.selectedPortRef = selectedPortRef; clearGhost(runtime); notifyPlacementState(runtime, placementType ? "hidden" : "idle"); if (placementType) runtime.transform.detach();
  }, [placementDirectionId, placementType, selectedPortRef]);

  useEffect(() => {
    const runtime = runtimeRef.current; if (!runtime || !asset) return; runtime.asset = asset; runtime.transform.detach(); clearGhost(runtime); if (runtime.model) { runtime.scene.remove(runtime.model); disposeObject3D(runtime.model); }
    const colors = SCENE_THEMES[theme] ?? SCENE_THEMES.dark; runtime.scene.background = new THREE.Color(colors.background); runtime.model = createCustomEquipmentGroup(asset, { selectedPartId, selectedPartIds, selectedPortId, showPorts: true, exposeParts: true, edgeColor: colors.equipmentEdge, selectionColor: colors.selection }); runtime.scene.add(runtime.model);
    const selected = findPart(runtime.model, selectedPartId); if (selected && transformMode !== "off" && !placementType) { runtime.transform.setMode(transformMode); runtime.transform.attach(selected); } runtime.selectedPartId = selectedPartId;
    const frameKey = `${asset.id}:${focusKey}`; if (framedRef.current !== frameKey) { framedRef.current = frameKey; const box = new THREE.Box3().setFromObject(runtime.model); const sphere = box.getBoundingSphere(new THREE.Sphere()); const radius = Math.max(1, sphere.radius); runtime.controls.target.copy(sphere.center); runtime.camera.position.copy(sphere.center).add(new THREE.Vector3(1.2, 0.9, 1.3).normalize().multiplyScalar(radius * 3.2)); runtime.camera.near = Math.max(0.02, radius / 100); runtime.camera.far = Math.max(300, radius * 30); runtime.camera.updateProjectionMatrix(); }
  }, [asset, focusKey, placementType, selectedPartId, selectedPartIds, selectedPortId, theme, transformMode]);

  return <div ref={hostRef} className={`${styles.preview} ${placementType ? styles.placementActive : ""}`} data-placement-state={placementType ? "active" : "idle"} role="application" aria-label={placementType ? "부품 배치 중인 커스텀 설비 3D 화면" : "커스텀 설비 3D 조립 화면"} />;
}
