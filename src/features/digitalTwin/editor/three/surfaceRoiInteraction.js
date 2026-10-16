import * as THREE from "three";
import { isVisibleSurfaceIntersection } from "./objectRaycast.js";
import { ROI_STATUSES } from "../model/roiMonitoring.js";
import { disposeObject3D } from "./disposeObject3D.js";

// Store raycast samples in equipment-local metres, independent of camera and
// equipment placement. These are geometry samples, never simulated sensor data.
export function bindSurfaceRoiInteraction({ renderer, camera, controls, renderedEquipment, getOptions, focus, cancelFocus }) {
  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const overlays = [];
  const rectangle = document.createElement("div");
  rectangle.style.cssText = "position:absolute;pointer-events:none;border:1px solid #469beb;background:rgba(70,155,235,.12);display:none;z-index:3";
  canvas.parentElement.appendChild(rectangle);
  let start = null, firstCorner = null, previousRois, previousStatuses, previousSelected, previousFocus;
  let previousEquipmentId, previousDrawing;

  function entryFor(options) { return renderedEquipment.get(options.equipmentId); }
  function visibleModel(entry) { return entry?.actual?.visible ? entry.actual : entry?.proxy; }
  function hitAt(x, y, entry) {
    const bounds = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1), camera);
    entry.object.updateWorldMatrix(true, true);
    return raycaster.intersectObject(visibleModel(entry), true).find((hit) => hit.object.isMesh && hit.face && isVisibleSurfaceIntersection(hit, entry.object));
  }
  function showRectangle(a, b) {
    const bounds = canvas.getBoundingClientRect();
    Object.assign(rectangle.style, { display: "block", left: `${Math.min(a.x, b.x) - bounds.left}px`, top: `${Math.min(a.y, b.y) - bounds.top}px`,
      width: `${Math.abs(a.x - b.x)}px`, height: `${Math.abs(a.y - b.y)}px` });
  }
  function createSurface(a, b) {
    const options = getOptions();
    const entry = entryFor(options);
    if (!entry) return;
    if (Math.abs(a.x - b.x) < 8 || Math.abs(a.y - b.y) < 8) { options.onError?.("ROI의 너비와 높이를 조금 더 크게 지정하세요."); return; }
    const vertices = [], triangles = [], outline = [], segments = 8;
    const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y);
    const width = Math.abs(a.x - b.x), height = Math.abs(a.y - b.y);
    for (let row = 0; row <= segments; row++) {
      for (let col = 0; col <= segments; col++) {
        const hit = hitAt(left + width * col / segments, top + height * row / segments, entry);
        if (!hit) { options.onError?.("사각형 전체가 같은 설비의 표면에 놓이도록 다시 지정하세요."); return; }
        const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
        const local = entry.object.worldToLocal(hit.point.clone().addScaledVector(normal, 0.002));
        vertices.push(local.toArray());
        if (row < segments && col < segments) {
          const index = row * (segments + 1) + col;
          triangles.push(index, index + 1, index + segments + 1, index + 1, index + segments + 2, index + segments + 1);
        }
      }
    }
    for (let col = 0; col <= segments; col++) outline.push(col);
    for (let row = 1; row <= segments; row++) outline.push(row * (segments + 1) + segments);
    for (let col = segments - 1; col >= 0; col--) outline.push(segments * (segments + 1) + col);
    for (let row = segments - 1; row > 0; row--) outline.push(row * (segments + 1));
    options.onCreate?.({ coordinateSpace: "EQUIPMENT_LOCAL", representation: entry.actual?.visible ? "ACTUAL" : "PROXY", vertices, triangles, outline });
  }
  function down(event) {
    if (!(getOptions().drawing || getOptions().pointPicking) || event.button !== 0) return;
    event.stopImmediatePropagation(); event.preventDefault();
    start = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if (!getOptions().drawing) return;
    event.stopImmediatePropagation();
    if (start || firstCorner) showRectangle(firstCorner ?? start, { x: event.clientX, y: event.clientY });
  }
  function up(event) {
    if (!(getOptions().drawing || getOptions().pointPicking) || !start) return;
    event.stopImmediatePropagation(); event.preventDefault();
    const end = { x: event.clientX, y: event.clientY };
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (getOptions().pointPicking) {
      const options = getOptions(), entry = entryFor(options);
      const hit = entry && hitAt(end.x, end.y, entry);
      if (hit) options.onPoint?.({ coordinateSpace: "EQUIPMENT_LOCAL", representation: entry.actual?.visible ? "ACTUAL" : "PROXY", position: entry.object.worldToLocal(hit.point.clone()).toArray() });
      else options.onError?.("선택한 설비의 표면을 클릭하세요.");
      start = null; return;
    }
    if (firstCorner) { createSurface(firstCorner, end); firstCorner = null; rectangle.style.display = "none"; }
    else if (Math.hypot(end.x - start.x, end.y - start.y) < 5) firstCorner = start;
    else { createSurface(start, end); rectangle.style.display = "none"; }
    start = null;
  }
  function cancel() { start = null; firstCorner = null; rectangle.style.display = "none"; }
  function keydown(event) { if (event.key === "Escape" && (getOptions().drawing || getOptions().pointPicking)) { cancel(); getOptions().onCancel?.(); } }
  canvas.addEventListener("pointerdown", down, true);
  canvas.addEventListener("pointermove", move, true);
  canvas.addEventListener("pointerup", up, true);
  canvas.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", keydown);
  function clearOverlays() { overlays.splice(0).forEach((item) => { item.removeFromParent(); disposeObject3D(item); }); }

  return {
    update() {
      const options = getOptions();
      const interacting = Boolean(options.drawing || options.pointPicking);
      if (previousDrawing !== interacting || previousEquipmentId !== options.equipmentId) {
        cancel(); controls.enabled = !interacting; canvas.style.cursor = interacting ? "crosshair" : "";
        if (interacting) cancelFocus?.();
        previousDrawing = interacting; previousEquipmentId = options.equipmentId;
      }
      if (previousRois !== options.rois || previousStatuses !== options.statuses || previousSelected !== options.selectedId) {
        clearOverlays();
        previousRois = options.rois; previousStatuses = options.statuses; previousSelected = options.selectedId;
        (options.rois ?? []).forEach((roi) => {
          const entry = renderedEquipment.get(roi.equipmentId);
          if (!entry || !roi.surface?.vertices?.length) return;
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
          entry.object.add(group);
          overlays.push(group);
        });
      }
      overlays.forEach((group) => {
        const entry = renderedEquipment.get(group.userData.equipmentId);
        group.visible = Boolean(entry) && group.userData.representation === (entry.actual?.visible ? "ACTUAL" : "PROXY");
      });
      if (options.focusVersion !== previousFocus) {
        const group = overlays.find((item) => item.userData.roiId === options.selectedId && item.visible);
        if (group && options.focusVersion) { focus(group); previousFocus = options.focusVersion; }
        else if (!options.focusVersion) previousFocus = options.focusVersion;
      }
    },
    dispose() {
      clearOverlays(); rectangle.remove();
      canvas.removeEventListener("pointerdown", down, true); canvas.removeEventListener("pointermove", move, true);
      canvas.removeEventListener("pointerup", up, true); canvas.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
    },
  };
}
