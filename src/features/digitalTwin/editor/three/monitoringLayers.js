import * as THREE from "three";
import { isFreshMeasurement, mediaUrl } from "../model/monitoringContract.js";

// Server-generated UV textures only. Do not infer UVs or sensor measurements.
export function bindMonitoringLayers({ renderedEquipment, getOptions }) {
  let identity = "", generation = 0, disposed = false, previousOptions, previousModel, previousSecond;
  const overlays = [], textures = [];
  function clear() {
    generation++;
    overlays.splice(0).forEach((object) => { object.removeFromParent(); object.material.dispose(); if (object.userData.ownsGeometry) object.geometry.dispose(); });
    textures.splice(0).forEach((texture) => texture.dispose());
  }
  return {
    update() {
      const options = getOptions(), entry = renderedEquipment.get(options.equipmentId);
      const model = entry?.actual?.visible ? entry.actual : entry?.proxy;
      const second = Math.floor((options.now ?? Date.now()) / 1000);
      if (options === previousOptions && model === previousModel && second === previousSecond) return;
      previousOptions = options; previousModel = model; previousSecond = second;
      const representation = entry?.actual?.visible ? "ACTUAL" : "PROXY";
      const records = options.mode === "ULTRASOUND" ? options.hotspots : (options.textures ?? []).filter((record) => record.kind === options.mode && record.mapping === "UV");
      const valid = (records ?? []).filter((record) => record.equipmentId === options.equipmentId && isFreshMeasurement(record, options.now)
        && record.modelVersion === options.model?.version && record.representation === representation);
      const mismatched = !valid.length && (records ?? []).some((record) => record.equipmentId === options.equipmentId && isFreshMeasurement(record, options.now) && (record.modelVersion !== options.model?.version || record.representation !== representation));
      const next = JSON.stringify([model?.uuid, options.mode, options.opacity, valid, options.point, mismatched]);
      if (next === identity) return;
      identity = next; clear();
      if (!entry || !model) return;
      options.onLayerError?.("");
      if (mismatched && options.mode !== "MODEL") options.onLayerError?.("현재 모델·표현과 관측 매핑이 다릅니다. 모델을 확인하고 센서 매핑을 다시 보정하세요.");
      const sphere = (position, color, radius) => {
        if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) return;
        const object = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .85, depthTest: false }));
        object.position.fromArray(position); object.userData.ownsGeometry = true; object.userData.monitoringOverlay = true;
        object.renderOrder = 5; entry.object.add(object); overlays.push(object);
      };
      if (options.point?.representation === representation) sphere(options.point.position, 0x4da8ff, .045);
      if (options.mode === "ULTRASOUND") valid.forEach((point) => sphere(point.position, Number(point.db) >= 80 ? 0xff6155 : 0xffc84a, Math.max(.035, Math.min(.25, Number(point.radius) || .08))));
      if (!["VISION", "THERMAL"].includes(options.mode)) return;
      const version = generation;
      valid.filter((record) => record.kind === options.mode).slice(0, 8).forEach((record) => {
        const url = mediaUrl(record.url, options.demo);
        if (!url || record.mapping !== "UV") { options.onLayerError?.("표시 가능한 UV 텍스처가 없습니다. 서버의 매핑 형식을 확인하세요."); return; }
        new THREE.TextureLoader().load(url, (texture) => {
          if (disposed || version !== generation) { texture.dispose(); return; }
          texture.colorSpace = THREE.SRGBColorSpace;
          textures.push(texture);
          let applied = 0;
          const walk = (object, path) => {
            if (object.userData.monitoringOverlay) return;
            if (object.isMesh && !object.isInstancedMesh && object.geometry?.attributes.uv && (!record.meshPath || record.meshPath === path)) {
              const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: options.opacity ?? .7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
              const overlay = new THREE.Mesh(object.geometry, material);
              overlay.userData.monitoringOverlay = true; overlay.raycast = () => {}; overlay.renderOrder = 2;
              object.add(overlay); overlays.push(overlay); applied++;
            }
            [...object.children].forEach((child, index) => walk(child, path ? `${path}/${index}` : String(index)));
          };
          walk(model, "");
          if (!applied) options.onLayerError?.("대상 메쉬의 UV 또는 경로를 찾을 수 없습니다. 서버 매핑을 확인하세요.");
        }, undefined, () => { if (!disposed && generation === version) options.onLayerError?.("관측 텍스처를 불러오지 못했습니다."); });
      });
    },
    dispose() { disposed = true; clear(); },
  };
}
