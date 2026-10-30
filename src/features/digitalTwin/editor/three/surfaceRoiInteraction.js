import * as THREE from "three";
import { clampRoiRadius, isObservationRoi } from "../model/roiMonitoring.js";
import { isVisibleSurfaceIntersection } from "./objectRaycast.js";
import { ROI_STATUSES } from "../model/roiMonitoring.js";
import { disposeObject3D } from "./disposeObject3D.js";
import { createRoiOverlay } from "./roiOverlay.js";

// Store raycast samples in equipment-local metres, independent of camera and
// equipment placement. These are geometry samples, never simulated sensor data.
export function bindSurfaceRoiInteraction({ renderer, camera, controls, renderedEquipment, getOptions, getPointMarker, focus, cancelFocus }) {
  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const overlays = [];
  let start = null, capturedPointer = null, previousRois, previousStatuses, previousSelected, previousFocus;
  let previousEquipmentId, previousDrawing = false, previousInteracting = false, controlsWereEnabled = true;

  function entryFor(options) { return renderedEquipment.get(options.equipmentId); }
  function visibleModel(entry) { return entry?.actual?.visible ? entry.actual : entry?.proxy; }
  function hitAt(x, y, entry) {
    const bounds = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1), camera);
    entry.object.updateWorldMatrix(true, true);
    const pick = (object) => {
      const meshes = [];
      function visit(node) {
        if (!node?.visible || node.userData.monitoringOverlay || node.userData.roiId || node.userData.sensorId) return;
        if (node.isMesh || node.isPoints) meshes.push(node);
        node.children.forEach(visit);
      }
      visit(object);
      return raycaster.intersectObjects(meshes, false).find((hit) => isVisibleSurfaceIntersection(hit, entry.object));
    };
    return pick(visibleModel(entry)) ?? (entry.actual?.visible && entry.proxy?.visible ? pick(entry.proxy) : undefined);
  }

  function down(event) {
    const options = getOptions();
    if (!(options.drawing || options.pointPicking) || event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY };
    if (options.drawing) {
      event.stopImmediatePropagation(); event.preventDefault();
      capturedPointer = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
    }
  }
  function up(event) {
    if (!(getOptions().drawing || getOptions().pointPicking) || !start) return;
    const options = getOptions(), entry = entryFor(options);
    if (options.drawing) { event.stopImmediatePropagation(); event.preventDefault(); }
    try {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
      if (entry?.loading) { options.onError?.("모델을 불러온 뒤 표면을 선택하세요."); return; }
      // A single hit keeps dense scans responsive during sphere placement.
      const hit = entry && hitAt(event.clientX, event.clientY, entry);
      if (!hit) { options.onError?.("선택한 설비의 표면을 클릭하세요."); return; }
      const position = entry.object.worldToLocal(hit.point.clone()).toArray();
      const reference = { coordinateSpace: "EQUIPMENT_LOCAL", representation: entry.actual?.visible ? "ACTUAL" : "PROXY" };
      if (options.pointPicking) options.onPoint?.({ ...reference, position });
      else options.onCreate?.({ ...reference, type: "SPHERE", center: position, radius: clampRoiRadius(options.radius ?? .15) });
    } catch (error) { options.onError?.(`영역을 선택하지 못했습니다. ${error.message}`); options.onCancel?.(); }
    finally { cancel(); }
  }
  function cancel() {
    if (capturedPointer !== null && canvas.hasPointerCapture(capturedPointer)) canvas.releasePointerCapture(capturedPointer);
    capturedPointer = null; start = null;
  }
  function abort() { cancel(); getOptions().onCancel?.(); }
  function keydown(event) { if (event.key === "Escape" && (getOptions().drawing || getOptions().pointPicking)) { cancel(); getOptions().onCancel?.(); } }
  canvas.addEventListener("pointerdown", down, true);
  canvas.addEventListener("pointerup", up, true);
  canvas.addEventListener("pointercancel", abort);
  window.addEventListener("keydown", keydown);
  window.addEventListener("blur", abort);
  function clearOverlays() { overlays.splice(0).forEach((item) => { item.removeFromParent(); disposeObject3D(item); }); }

  return {
    update() {
      const options = getOptions();
      const interacting = Boolean(options.drawing || options.pointPicking);
      if (previousDrawing !== Boolean(options.drawing)) {
        if (options.drawing) { controlsWereEnabled = controls.enabled; controls.enabled = false; }
        else controls.enabled = controlsWereEnabled;
        previousDrawing = Boolean(options.drawing);
      }
      if (previousInteracting !== interacting || previousEquipmentId !== options.equipmentId) {
        cancel();
        canvas.style.cursor = interacting ? "crosshair" : "";
        if (interacting) cancelFocus?.();
        previousInteracting = interacting; previousEquipmentId = options.equipmentId;
      }
      if (previousRois !== options.rois || previousStatuses !== options.statuses || previousSelected !== options.selectedId) {
        clearOverlays();
        previousRois = options.rois; previousStatuses = options.statuses; previousSelected = options.selectedId;
        (options.rois ?? []).forEach((roi) => {
          const entry = renderedEquipment.get(roi.equipmentId);
          if (!entry || isObservationRoi(roi) || !roi.surface?.vertices?.length) return;
          const group = new THREE.Group();
          const status = options.statuses?.[roi.id] ?? "NO_DATA";
          const selected = options.selectedId === roi.id;
          const color = ["WARNING", "DANGER"].includes(status) ? ROI_STATUSES[status].color : selected ? "#469beb" : ROI_STATUSES.NO_DATA.color;
          const points = roi.surface.vertices.map((point) => new THREE.Vector3().fromArray(point));
          const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(roi.surface.outline.map((index) => points[index])), new THREE.LineBasicMaterial({ color }));
          group.add(border);
          if (selected) {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            geometry.setIndex(roi.surface.triangles);
            group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.12, depthWrite: false })));
          }
          group.userData = { roiId: roi.id, equipmentId: roi.equipmentId, representation: roi.surface.representation };
          group.traverse((object) => { object.raycast = () => {}; object.userData.monitoringOverlay = true; });
          createRoiOverlay(group);
          entry.object.add(group);
          overlays.push(group);
        });
      }
      overlays.forEach((group) => {
        const entry = renderedEquipment.get(group.userData.equipmentId);
        group.visible = Boolean(entry && !entry.loading) && (group.userData.representation === "BOTH" || group.userData.representation === (entry.actual?.visible ? "ACTUAL" : "PROXY"));
      });
      if (options.focusVersion !== previousFocus) {
        const marker = getPointMarker?.(options.selectedId);
        const group = marker?.visible ? marker : overlays.find((item) => item.userData.roiId === options.selectedId && item.visible);
        if (group && options.focusVersion) { focus(group); previousFocus = options.focusVersion; }
        else if (!options.focusVersion) previousFocus = options.focusVersion;
      }
    },
    dispose() {
      cancel(); clearOverlays(); if (previousDrawing) controls.enabled = controlsWereEnabled; canvas.style.cursor = "";
      canvas.removeEventListener("pointerdown", down, true);
      canvas.removeEventListener("pointerup", up, true); canvas.removeEventListener("pointercancel", abort);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("blur", abort);
    },
  };
}
