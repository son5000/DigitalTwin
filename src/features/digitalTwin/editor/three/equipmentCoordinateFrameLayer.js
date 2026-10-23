import * as THREE from "three";
import { equipmentBounds, frontLowerLeft, getEquipmentCoordinateFrame } from "../model/equipmentCoordinateFrame.js";
import { disposeObject3D } from "./disposeObject3D.js";

export function bindEquipmentCoordinateFrame({ renderer, camera, controls, renderedEquipment, getEquipment, getStage, getBinding }) {
  let preview = null, picker = null, down = null, previousKey = "", helper = null;
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
  canvas.addEventListener("pointerdown", pointerDown, true);
  canvas.addEventListener("pointerup", pointerUp, true);
  canvas.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", keydown);
  window.addEventListener("blur", cancel);
  function clear() { if (helper) { helper.removeFromParent(); disposeObject3D(helper); helper = null; } }
  function label(text, color, position, size) {
    const image = document.createElement("canvas"); image.width = 512; image.height = 96;
    const context = image.getContext("2d");
    context.font = "600 38px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillStyle = "rgba(8,18,25,.88)"; context.fillRect(0, 0, image.width, image.height);
    context.fillStyle = color; context.fillText(text, 256, 48);
    const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }));
    sprite.position.copy(position); sprite.scale.set(size * 1.8, size * .34, 1); sprite.userData.coordinateLabel = true; helper.add(sprite);
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
      const enabled = entry && ["ASSET", "SENSOR", "POINT"].includes(stage);
      if (!enabled) { if (picker) cancel(); if (helper) helper.visible = false; return; }
      const frame = preview ?? getEquipmentCoordinateFrame(equipment);
      const key = JSON.stringify([equipment.id, frame, equipment.dimensions]);
      if (key !== previousKey || !helper) {
        previousKey = key; clear(); helper = new THREE.Group();
        const fallback = frontLowerLeft(equipmentBounds(equipment));
        helper.position.fromArray(frame?.origin ?? [fallback.x, fallback.y, fallback.z]); helper.rotation.fromArray([...(frame?.rotation ?? [0, 0, 0]), "XYZ"]);
        const size = Math.max(.15, Math.min(1, (equipment.dimensions?.height ?? 1) * .24));
        const axes = new THREE.AxesHelper(size); helper.add(axes);
        label("X · 오른쪽", "#ff9696", new THREE.Vector3(size * 1.5, 0, 0), size * .55);
        label("Y · 위", "#a5e99d", new THREE.Vector3(0, size * 1.25, 0), size * .55);
        label("Z · 정면", "#91c6ff", new THREE.Vector3(0, 0, size * 1.5), size * .55);
        label("0, 0, 0", "#ffffff", new THREE.Vector3(0, -size * .18, 0), size * .45);
        helper.traverse((object) => { object.userData.monitoringOverlay = true; object.raycast = () => {}; object.renderOrder = 1000; if (object.material) { object.material.depthTest = false; object.material.depthWrite = false; } });
        entry.object.add(helper);
      }
      helper.visible = true;
      // Keep axis labels readable at any working zoom without resizing the datum.
      helper.updateWorldMatrix(true, false);
      const viewportHeight = Math.max(1, canvas.clientHeight);
      helper.children.filter((object) => object.userData.coordinateLabel).forEach((sprite) => {
        const distance = camera.position.distanceTo(sprite.getWorldPosition(new THREE.Vector3()));
        const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom * 22 / viewportHeight;
        sprite.scale.set(height * 512 / 96, height, 1);
      });
    },
    dispose() { cancel(); clear(); canvas.removeEventListener("pointerdown", pointerDown, true); canvas.removeEventListener("pointerup", pointerUp, true); canvas.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", keydown); window.removeEventListener("blur", cancel); },
  };
}
