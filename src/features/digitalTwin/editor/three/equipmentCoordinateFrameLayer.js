import * as THREE from "three";
import { equipmentBounds, frontLowerLeft, getEquipmentCoordinateFrame } from "../model/equipmentCoordinateFrame.js";
import { getEnclosure, getEnclosureDoorEntries, getEnclosureScanSlot } from "../model/equipmentEnclosure.js";
import { disposeObject3D } from "./disposeObject3D.js";

export function bindEquipmentCoordinateFrame({ renderer, camera, controls, renderedEquipment, getEquipment, getStage, getBinding, theme = "dark" }) {
  let preview = null, picker = null, down = null, previousKey = "", helper = null;
  let previousSlotKey = "", slotHelper = null;
  let slotMarkers = [], hoveredSlot = null;
  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  function bounds() {
    const equipment = getEquipment(), entry = renderedEquipment.get(equipment?.id), binding = getBinding(equipment?.id);
    if (!binding || binding.includeProxy) return equipmentBounds(equipment);
    if (!entry?.actual) return null;
    entry.object.updateWorldMatrix(true, true);
    const inverse = entry.object.matrixWorld.clone().invert(), box = new THREE.Box3();
    entry.actual.traverse((object) => {
      if (!object.geometry || object.userData.monitoringOverlay) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      box.union(object.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld)));
    });
    return box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray() };
  }
  function cancel() { const callback = picker; picker = null; down = null; canvas.style.cursor = ""; callback?.(null); }
  function pointerDown(event) {
    if (!picker || event.button !== 0) return;
    event.stopImmediatePropagation(); event.preventDefault(); down = [event.clientX, event.clientY];
  }
  function pointerUp(event) {
    if (!picker || !down || event.button !== 0) return;
    event.stopImmediatePropagation(); event.preventDefault();
    const start = down; down = null;
    if (Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) return;
    const entry = renderedEquipment.get(getEquipment()?.id);
    if (!entry || entry.loading) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    raycaster.params.Points.threshold = .02;
    const hit = raycaster.intersectObjects([entry.actual, entry.proxy].filter((object) => object?.visible), true).find(({ object }) => {
      for (let current = object; current; current = current.parent) if (!current.visible || current.userData.monitoringOverlay) return false;
      return object.isMesh || object.isPoints;
    });
    if (!hit) return;
    const point = entry.object.worldToLocal(hit.point.clone()), callback = picker;
    picker = null; canvas.style.cursor = ""; callback({ x: point.x, y: point.y, z: point.z });
  }
  function keydown(event) { if (event.key === "Escape") cancel(); }
  function clearHover() { if (hoveredSlot) hoveredSlot.tooltip.visible = false; hoveredSlot = null; }
  function showSlotAt(event) {
    if (!slotHelper?.visible || picker || event.buttons) { clearHover(); return; }
    const rect = canvas.getBoundingClientRect();
    let nearest = null, nearestDistance = 14 * 14;
    for (const item of slotMarkers) {
      const point = item.marker.getWorldPosition(new THREE.Vector3()).project(camera);
      if (point.z < -1 || point.z > 1) continue;
      const x = (point.x + 1) * rect.width / 2, y = (1 - point.y) * rect.height / 2;
      const distance = (event.clientX - rect.left - x) ** 2 + (event.clientY - rect.top - y) ** 2;
      if (distance < nearestDistance) { nearest = item; nearestDistance = distance; }
    }
    if (nearest === hoveredSlot) return;
    clearHover(); hoveredSlot = nearest;
    if (hoveredSlot) hoveredSlot.tooltip.visible = true;
  }
  function pointerMove(event) { showSlotAt(event); }
  canvas.addEventListener("pointerdown", pointerDown, true);
  canvas.addEventListener("pointerup", pointerUp, true);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerleave", clearHover);
  window.addEventListener("keydown", keydown);
  window.addEventListener("blur", cancel);
  function clear() { if (helper) { helper.removeFromParent(); disposeObject3D(helper); helper = null; } }
  function clearSlots() { clearHover(); slotMarkers = []; if (slotHelper) { slotHelper.removeFromParent(); disposeObject3D(slotHelper); slotHelper = null; } }
  function label(axis, text, color, position) {
    const image = document.createElement("canvas"); image.width = 320; image.height = 64;
    const context = image.getContext("2d");
    const light = theme === "light";
    const width = axis === "O" ? 154 : 116;
    context.scale(2, 2);
    context.fillStyle = light ? "rgba(247,250,251,.96)" : "rgba(9,18,25,.94)";
    context.strokeStyle = light ? "rgba(50,72,84,.30)" : "rgba(205,225,234,.24)";
    context.lineWidth = 1;
    context.beginPath(); context.roundRect(.5, .5, width - 1, 27, 4); context.fill(); context.stroke();
    context.fillStyle = color;
    context.beginPath(); context.roundRect(1.5, 1.5, 27, 25, [3, 0, 0, 3]); context.fill();
    context.fillStyle = light ? "#10242e" : "#071116";
    context.font = "800 12px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(axis, 15, 14.5);
    context.fillStyle = light ? "#18313d" : "#eef5f7";
    context.font = "650 11px system-ui, sans-serif";
    context.textAlign = "left";
    context.fillText(text, 37, 14.5);
    const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.repeat.set(width / 160, 1);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    sprite.position.copy(position); sprite.userData.coordinateLabel = true; sprite.userData.pixelWidth = width; sprite.userData.pixelHeight = 28; helper.add(sprite);
  }
  function slotTooltip(door, slot, marker, size) {
    const image = document.createElement("canvas"); image.width = 480; image.height = 96;
    const context = image.getContext("2d"); context.scale(2, 2);
    const light = theme === "light";
    context.fillStyle = light ? "rgba(247,250,251,.97)" : "rgba(9,18,25,.95)";
    context.strokeStyle = light ? "rgba(50,72,84,.36)" : "rgba(205,225,234,.28)";
    context.beginPath(); context.roundRect(.5, .5, 239, 45, 5); context.fill(); context.stroke();
    context.fillStyle = "#e7b66d"; context.fillRect(1, 1, 3, 44);
    context.fillStyle = light ? "#18313d" : "#eef5f7";
    context.font = "650 11px system-ui, sans-serif";
    context.fillText(`${door.label} · 공간 기준 (0, 0, 0)`, 12, 18);
    context.fillStyle = light ? "#48616b" : "#b9cbd1";
    context.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
    context.fillText(`설비 X ${slot.origin.x.toFixed(2)}  Y ${slot.origin.y.toFixed(2)}  Z ${slot.origin.z.toFixed(2)} m`, 12, 35);
    const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    sprite.position.set(size * 1.5, size * 2.5, 0);
    sprite.userData.coordinateLabel = true; sprite.userData.pixelWidth = 240; sprite.userData.pixelHeight = 48;
    sprite.visible = false; marker.add(sprite);
    return sprite;
  }
  return {
    bounds,
    preview(value) { preview = value; },
    pick(callback) { cancel(); picker = callback; canvas.style.cursor = callback ? "crosshair" : ""; },
    front(yaw) {
      const entry = renderedEquipment.get(getEquipment()?.id);
      if (!entry) return;
      const distance = Math.max(.5, camera.position.distanceTo(controls.target));
      const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).applyQuaternion(entry.object.getWorldQuaternion(new THREE.Quaternion()));
      camera.position.copy(controls.target).addScaledVector(direction, distance); camera.up.set(0, 1, 0); controls.update();
    },
    update() {
      const equipment = getEquipment(), stage = getStage(), entry = renderedEquipment.get(equipment?.id);
      const enabled = entry && ["ASSET", "SCAN", "SENSOR", "POINT"].includes(stage);
      if (!enabled) { if (picker) cancel(); clearHover(); if (helper) helper.visible = false; if (slotHelper) slotHelper.visible = false; return; }
      const frame = preview ?? getEquipmentCoordinateFrame(equipment);
      const key = JSON.stringify([equipment.id, frame, equipment.dimensions]);
      if (key !== previousKey || !helper) {
        previousKey = key; clear(); helper = new THREE.Group();
        const fallback = frontLowerLeft(equipmentBounds(equipment));
        helper.position.fromArray(frame?.origin ?? [fallback.x, fallback.y, fallback.z]); helper.rotation.fromArray([...(frame?.rotation ?? [0, 0, 0]), "XYZ"]);
        const size = Math.max(.15, Math.min(1, (equipment.dimensions?.height ?? 1) * .24));
        const axes = new THREE.AxesHelper(size); helper.add(axes);
        label("Z", "정면", "#79b8ef", new THREE.Vector3(0, 0, size * 1.5));
        label("O", "기준점 · 0, 0, 0", theme === "light" ? "#78909c" : "#a8bac3", new THREE.Vector3(0, -size * .18, 0));
        helper.traverse((object) => { object.userData.monitoringOverlay = true; object.raycast = () => {}; object.renderOrder = 1000; if (object.material) { object.material.depthTest = false; object.material.depthWrite = false; } });
        entry.object.add(helper);
      }
      helper.visible = true;
      const slots = getEnclosure(equipment).enabled ? getEnclosureDoorEntries(equipment).map((door) => ({
        door, slot: getEnclosureScanSlot(equipment, door.index, door.side),
      })).filter(({ slot }) => slot) : [];
      const slotKey = JSON.stringify([equipment.id, slots.map(({ door, slot }) => [door.label, slot.origin, slot.rotationY, slot.dimensions])]);
      if (slotKey !== previousSlotKey) {
        previousSlotKey = slotKey; clearSlots();
        if (slots.length) {
          slotHelper = new THREE.Group();
          for (const { door, slot } of slots) {
            const marker = new THREE.Group();
            marker.position.set(slot.origin.x, slot.origin.y, slot.origin.z);
            marker.rotation.y = slot.rotationY;
            const size = Math.max(.04, Math.min(.1, Math.min(slot.dimensions.width, slot.dimensions.height) * .14));
            marker.add(new THREE.AxesHelper(size));
            const point = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: "#e7b66d" }));
            marker.add(point);
            const tooltip = slotTooltip(door, slot, marker, size);
            slotMarkers.push({ marker, point, tooltip });
            slotHelper.add(marker);
          }
          slotHelper.traverse((object) => {
            object.userData.monitoringOverlay = true; object.raycast = () => {}; object.renderOrder = 1000;
            if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              material.depthTest = false; material.depthWrite = false;
            }
          });
          entry.object.add(slotHelper);
        }
      }
      if (slotHelper) slotHelper.visible = true;
      // Keep axis labels readable at any working zoom without resizing the datum.
      helper.updateWorldMatrix(true, false);
      slotHelper?.updateWorldMatrix(true, true);
      const viewportHeight = Math.max(1, canvas.clientHeight);
      for (const group of [helper, slotHelper]) group?.traverse((sprite) => {
        if (!sprite.userData.coordinateLabel) return;
        const distance = camera.position.distanceTo(sprite.getWorldPosition(new THREE.Vector3()));
        const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom * sprite.userData.pixelHeight * .8 / viewportHeight;
        sprite.scale.set(height * sprite.userData.pixelWidth / sprite.userData.pixelHeight, height, 1);
      });
      for (const { marker, point } of slotMarkers) {
        const distance = camera.position.distanceTo(marker.getWorldPosition(new THREE.Vector3()));
        const radius = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom * 4 / viewportHeight;
        point.scale.setScalar(radius);
      }
    },
    dispose() { cancel(); clear(); clearSlots(); canvas.removeEventListener("pointerdown", pointerDown, true); canvas.removeEventListener("pointerup", pointerUp, true); canvas.removeEventListener("pointercancel", cancel); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerleave", clearHover); window.removeEventListener("keydown", keydown); window.removeEventListener("blur", cancel); },
  };
}
