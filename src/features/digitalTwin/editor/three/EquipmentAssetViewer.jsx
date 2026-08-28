import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { ASSET_TYPES, EQUIPMENT_DISPLAY_MODES, unitScale } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { disposeObject3D } from "@/features/digitalTwin/editor/three/disposeObject3D";

import styles from "./EquipmentAssetViewer.module.css";

function createProxy(equipment, translucent = false) {
  const dimensions = equipment?.dimensions ?? { width: 1, height: 2, depth: 0.8 };
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth),
    new THREE.MeshStandardMaterial({ color: 0x4b718c, roughness: 0.55, transparent: translucent, opacity: translucent ? 0.28 : 0.86, wireframe: translucent }),
  );
  mesh.position.y = dimensions.height / 2;
  return mesh;
}

async function loadBindingObject(binding) {
  const source = binding.objectUrl ?? binding.sourceKey;
  if (!source || binding.status === "MISSING_LOCAL_FILE") throw new Error("MISSING_LOCAL_FILE");
  if (binding.assetType === ASSET_TYPES.OBJ) {
    const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
    const loader = new OBJLoader();
    if (binding.relatedSourceKey) {
      const { MTLLoader } = await import("three/addons/loaders/MTLLoader.js");
      const directory = binding.relatedSourceKey.slice(0, binding.relatedSourceKey.lastIndexOf("/") + 1);
      const materials = await new MTLLoader().setResourcePath(directory).loadAsync(binding.relatedSourceKey);
      materials.preload();
      loader.setMaterials(materials);
    }
    return loader.loadAsync(source);
  }
  if (binding.assetType === ASSET_TYPES.PLY) {
    const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
    const geometry = await new PLYLoader().loadAsync(source);
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.008, vertexColors: geometry.hasAttribute("color"), color: 0xaad8e8, sizeAttenuation: true }));
    return points;
  }
  throw new Error("UNSUPPORTED");
}

function fitCamera(camera, controls, object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  camera.position.copy(center).add(new THREE.Vector3(radius * 1.2, radius * 0.8, radius * 1.35));
  camera.near = Math.max(radius / 1000, 0.001); camera.far = radius * 100; camera.updateProjectionMatrix();
  controls.target.copy(center); controls.update();
}

export default function EquipmentAssetViewer({ equipment, binding, onAlignmentChange }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onAlignmentChange);
  const [loadState, setLoadState] = useState("PROXY");
  useEffect(() => { callbackRef.current = onAlignmentChange; }, [onAlignmentChange]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !equipment) return undefined;
    let cancelled = false; let frameId; let actualObject;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1217);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "설비 실제 자산 정합 3D 뷰어"); mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000); camera.position.set(3, 2.4, 3.4);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xdaf5ff, 0x17232b, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.4); light.position.set(4, 7, 5); scene.add(light);
    const grid = new THREE.GridHelper(12, 24, 0x456577, 0x243843); scene.add(grid);
    const content = new THREE.Group(); scene.add(content);
    const mode = binding?.displayMode ?? EQUIPMENT_DISPLAY_MODES.PROXY;
    const proxy = createProxy(equipment, mode === EQUIPMENT_DISPLAY_MODES.COMPARE); proxy.visible = mode !== EQUIPMENT_DISPLAY_MODES.ACTUAL && mode !== EQUIPMENT_DISPLAY_MODES.POINT_CLOUD; content.add(proxy);
    const transform = new TransformControls(camera, renderer.domElement); transform.setMode("translate"); transform.setTranslationSnap(0.01); scene.add(transform.getHelper());
    transform.addEventListener("dragging-changed", (event) => { controls.enabled = !event.value; if (!event.value && transform.object) callbackRef.current?.({ position: { x: transform.object.position.x, y: transform.object.position.y, z: transform.object.position.z }, rotation: { x: transform.object.rotation.x, y: transform.object.rotation.y, z: transform.object.rotation.z } }); });

    function resize() { const rect = mount.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();

    async function initialize() {
      if (!binding || mode === EQUIPMENT_DISPLAY_MODES.PROXY || [ASSET_TYPES.IMAGE, ASSET_TYPES.TEXTURE].includes(binding.assetType)) { setLoadState(mode === EQUIPMENT_DISPLAY_MODES.PROXY ? "PROXY" : "NO_3D"); fitCamera(camera, controls, proxy); return; }
      setLoadState("LOADING");
      try {
        actualObject = await loadBindingObject(binding);
        if (cancelled) { disposeObject3D(actualObject); return; }
        actualObject.scale.setScalar(unitScale(binding.alignmentTransform.unit));
        actualObject.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(actualObject); const center = bounds.getCenter(new THREE.Vector3()); const size = bounds.getSize(new THREE.Vector3());
        const aligned = new THREE.Group(); aligned.add(actualObject);
        if (binding.alignmentTransform.autoCentered) { actualObject.position.x -= center.x; actualObject.position.z -= center.z; actualObject.position.y -= binding.alignmentTransform.floorAligned ? bounds.min.y : center.y; }
        const proxyDimensions = equipment.dimensions ?? { width: 1, height: 2, depth: 0.8 };
        const fitScale = binding.alignmentTransform.fitToProxy ? Math.min(proxyDimensions.width / Math.max(size.x, 0.001), proxyDimensions.height / Math.max(size.y, 0.001), proxyDimensions.depth / Math.max(size.z, 0.001)) : 1;
        const alignment = binding.alignmentTransform; aligned.position.set(alignment.position.x, alignment.position.y, alignment.position.z); aligned.rotation.set(alignment.rotation.x, alignment.rotation.y, alignment.rotation.z); aligned.scale.set(alignment.scale.x * fitScale, alignment.scale.y * fitScale, alignment.scale.z * fitScale);
        content.add(aligned); transform.attach(aligned); fitCamera(camera, controls, content); setLoadState("READY");
      } catch (error) { if (!cancelled) setLoadState(error.message === "MISSING_LOCAL_FILE" ? "MISSING" : error.message === "UNSUPPORTED" ? "UNSUPPORTED" : "ERROR"); }
    }
    function render() { controls.update(); renderer.render(scene, camera); frameId = requestAnimationFrame(render); }
    initialize(); render();
    return () => { cancelled = true; cancelAnimationFrame(frameId); observer.disconnect(); transform.detach(); transform.dispose(); controls.dispose(); disposeObject3D(content); grid.geometry.dispose(); grid.material.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [binding, equipment]);

  const messages = { PROXY: "Proxy Model 표시 중", LOADING: "대용량 스캔 자산을 불러오는 중…", READY: "실제 자산 정합 모드", NO_3D: "이미지·텍스처는 하단 카메라 화면에서 확인합니다.", MISSING: "업로드 원본 파일을 다시 연결해 주세요.", UNSUPPORTED: "지원하지 않는 파일 형식입니다.", ERROR: "자산을 불러오지 못했습니다." };
  return <section className={styles.viewer} aria-label="설비 실제 자산 뷰어"><div ref={mountRef} className={styles.canvas} /><div className={styles.status} data-state={loadState}>{messages[loadState]}</div></section>;
}
