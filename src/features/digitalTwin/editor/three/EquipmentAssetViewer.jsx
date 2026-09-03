import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { equipmentAssetRepository } from "@/features/digitalTwin/editor/api/equipmentAssetRepository";
import { ASSET_TYPES, EQUIPMENT_DISPLAY_MODES, unitScale } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { createEquipmentObject } from "@/features/digitalTwin/editor/objects/EquipmentFactory";
import { disposeObject3D } from "@/features/digitalTwin/editor/three/disposeObject3D";

import styles from "./EquipmentAssetViewer.module.css";

function createProxy(equipment, translucent = false, theme = "dark") {
  return createEquipmentObject({
    ...equipment,
    position: { x: 0, y: 0, z: 0 },
    visible: true,
    appearance: { ...equipment.appearance, opacity: translucent ? 0.28 : 1 },
  }, { theme, viewerTranslucent: translucent, enableLod: false });
}

async function resolveBindingSources(binding) {
  if (binding.objectUrl) return { source: binding.objectUrl, relatedSource: binding.relatedSourceKey, textureSource: binding.textureSourceKey, revoke: () => {} };
  if (binding.sourceType !== "UPLOAD") return { source: binding.sourceKey, relatedSource: binding.relatedSourceKey, textureSource: binding.textureSourceKey, revoke: () => {} };
  const asset = await equipmentAssetRepository.get(binding.assetId);
  if (!asset?.files?.length) throw new Error("MISSING_LOCAL_FILE");
  const objectUrls = asset.files.map((file) => ({
    name: file.name,
    path: (file.path || file.name).replace(/\\/g, "/"),
    url: URL.createObjectURL(file.blob),
  }));
  const findObjectUrl = (reference = "") => {
    const normalized = decodeURIComponent(reference).split(/[?#]/)[0].replace(/\\/g, "/").toLocaleLowerCase();
    const fileName = normalized.split("/").pop();
    return objectUrls.find((entry) => entry.path.toLocaleLowerCase() === normalized)?.url
      ?? objectUrls.find((entry) => entry.name.toLocaleLowerCase() === fileName)?.url
      ?? null;
  };
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => findObjectUrl(url) ?? url);
  return {
    source: findObjectUrl(asset.primaryFilePath ?? asset.primaryFileName) ?? findObjectUrl(binding.sourceKey),
    relatedSource: findObjectUrl(binding.relatedSourceKey),
    textureSource: findObjectUrl(binding.textureSourceKey),
    manager,
    revoke: () => objectUrls.forEach((entry) => URL.revokeObjectURL(entry.url)),
  };
}

async function loadBindingObject(binding) {
  const sources = await resolveBindingSources(binding);
  const { source, relatedSource, textureSource, manager, revoke } = sources;
  if (!source) { revoke(); throw new Error("MISSING_LOCAL_FILE"); }
  try {
    if (binding.assetType === ASSET_TYPES.OBJ) {
      const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
      const loader = new OBJLoader(manager);
      let fallbackMaterial = false;
      if (relatedSource) {
        try {
          const { MTLLoader } = await import("three/addons/loaders/MTLLoader.js");
          const materials = await new MTLLoader(manager).loadAsync(relatedSource);
          materials.preload();
          loader.setMaterials(materials);
        } catch {
          fallbackMaterial = true;
        }
      }
      const object = await loader.loadAsync(source);
      let meshCount = 0;
      object.traverse((child) => {
        if (!child.isMesh) return;
        meshCount += 1;
        if (!child.material) {
          child.material = new THREE.MeshStandardMaterial({ color: 0x8fb3c2, roughness: 0.62 });
          fallbackMaterial = true;
        }
      });
      if (!meshCount) throw new Error("EMPTY_MODEL");
      return { object, revoke, fallbackMaterial };
    }
    if (binding.assetType === ASSET_TYPES.PLY) {
      const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
      const geometry = await new PLYLoader(manager).loadAsync(source);
      if (!geometry.getAttribute("position")?.count) throw new Error("EMPTY_MODEL");
      const hasFaces = Boolean(geometry.index?.count);
      const hasVertexColors = geometry.hasAttribute("color");
      let texture = null;
      let fallbackMaterial = Boolean(textureSource && !geometry.hasAttribute("uv"));
      if (textureSource && geometry.hasAttribute("uv")) {
        try {
          texture = await new THREE.TextureLoader(manager).loadAsync(textureSource);
          texture.colorSpace = THREE.SRGBColorSpace;
        } catch {
          fallbackMaterial = true;
        }
      }
      if (hasFaces) {
        if (!geometry.hasAttribute("normal")) geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ map: texture, color: texture ? 0xffffff : 0x8fb3c2, roughness: 0.62, vertexColors: hasVertexColors, side: THREE.DoubleSide });
        return { object: new THREE.Mesh(geometry, material), revoke, fallbackMaterial };
      }
      geometry.computeBoundingSphere();
      const pointSize = Math.max((geometry.boundingSphere?.radius ?? 1) / 220, 0.008);
      return { object: new THREE.Points(geometry, new THREE.PointsMaterial({ size: pointSize, vertexColors: hasVertexColors, color: 0xaad8e8, sizeAttenuation: true })), revoke, fallbackMaterial };
    }
    throw new Error("UNSUPPORTED");
  } catch (error) {
    revoke();
    throw error;
  }
}

function fitCamera(camera, controls, object) {
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return false;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  if (![sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius].every(Number.isFinite)) return false;
  const radius = Math.max(sphere.radius, 0.5);
  const distance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.2;
  camera.position.copy(sphere.center).add(new THREE.Vector3(distance * 0.75, distance * 0.55, distance));
  camera.near = Math.max(distance / 300, 0.001); camera.far = distance * 50; camera.updateProjectionMatrix();
  controls.target.copy(sphere.center); controls.update();
  return true;
}

export default function EquipmentAssetViewer({ equipment, binding, theme = "dark", onAlignmentChange }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onAlignmentChange);
  const [loadState, setLoadState] = useState("PROXY");
  const [loadMessage, setLoadMessage] = useState("");
  useEffect(() => { callbackRef.current = onAlignmentChange; }, [onAlignmentChange]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !equipment) return undefined;
    let cancelled = false; let frameId; let actualObject; let revokeSources = () => {};
    const scene = new THREE.Scene(); scene.background = new THREE.Color(theme === "light" ? 0xe8eef1 : 0x0b1217);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "설비 실제 자산 정합 3D 뷰어"); mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000); camera.position.set(3, 2.4, 3.4);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xdaf5ff, 0x17232b, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.4); light.position.set(4, 7, 5); scene.add(light);
    const planeSize = Math.max(equipment.dimensions?.width ?? 1, equipment.dimensions?.depth ?? 1, 1) * 8;
    const grid = new THREE.GridHelper(planeSize, 24, 0x456577, 0x243843); scene.add(grid);
    const content = new THREE.Group(); scene.add(content);
    const mode = binding?.displayMode ?? EQUIPMENT_DISPLAY_MODES.PROXY;
    const proxy = createProxy(equipment, mode === EQUIPMENT_DISPLAY_MODES.COMPARE, theme); proxy.visible = mode !== EQUIPMENT_DISPLAY_MODES.ACTUAL && mode !== EQUIPMENT_DISPLAY_MODES.POINT_CLOUD; content.add(proxy);
    const transform = new TransformControls(camera, renderer.domElement); transform.setMode("translate"); transform.setTranslationSnap(0.01); scene.add(transform.getHelper());
    transform.addEventListener("dragging-changed", (event) => { controls.enabled = !event.value; if (!event.value && transform.object) callbackRef.current?.({ position: { x: transform.object.position.x, y: transform.object.position.y, z: transform.object.position.z }, rotation: { x: transform.object.rotation.x, y: transform.object.rotation.y, z: transform.object.rotation.z } }); });

    function resize() { const rect = mount.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();

    async function initialize() {
      if (!binding || mode === EQUIPMENT_DISPLAY_MODES.PROXY || [ASSET_TYPES.IMAGE, ASSET_TYPES.TEXTURE].includes(binding.assetType)) { setLoadState(mode === EQUIPMENT_DISPLAY_MODES.PROXY ? "PROXY" : "NO_3D"); fitCamera(camera, controls, proxy); return; }
      setLoadState("LOADING");
      setLoadMessage("");
      try {
        const loaded = await loadBindingObject(binding);
        actualObject = loaded.object;
        revokeSources = loaded.revoke;
        if (cancelled) { disposeObject3D(actualObject); revokeSources(); return; }
        actualObject.scale.setScalar(unitScale(binding.alignmentTransform.unit));
        actualObject.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(actualObject);
        if (bounds.isEmpty()) throw new Error("EMPTY_MODEL");
        const center = bounds.getCenter(new THREE.Vector3()); const size = bounds.getSize(new THREE.Vector3());
        const aligned = new THREE.Group(); aligned.add(actualObject);
        if (binding.alignmentTransform.autoCentered) { actualObject.position.x -= center.x; actualObject.position.z -= center.z; actualObject.position.y -= binding.alignmentTransform.floorAligned ? bounds.min.y : center.y; }
        const proxyDimensions = equipment.dimensions ?? { width: 1, height: 2, depth: 0.8 };
        const fitScale = binding.alignmentTransform.fitToProxy ? Math.min(proxyDimensions.width / Math.max(size.x, 0.001), proxyDimensions.height / Math.max(size.y, 0.001), proxyDimensions.depth / Math.max(size.z, 0.001)) : 1;
        const alignment = binding.alignmentTransform; aligned.position.set(alignment.position.x, alignment.position.y, alignment.position.z); aligned.rotation.set(alignment.rotation.x, alignment.rotation.y, alignment.rotation.z); aligned.scale.set(alignment.scale.x * fitScale, alignment.scale.y * fitScale, alignment.scale.z * fitScale);
        content.add(aligned); aligned.updateMatrixWorld(true); transform.attach(aligned);
        if (!fitCamera(camera, controls, aligned)) throw new Error("EMPTY_MODEL");
        setLoadState(loaded.fallbackMaterial ? "READY_FALLBACK" : "READY");
      } catch (error) {
        if (cancelled) return;
        proxy.visible = true;
        fitCamera(camera, controls, proxy);
        const state = error.message === "MISSING_LOCAL_FILE" ? "MISSING" : error.message === "UNSUPPORTED" ? "UNSUPPORTED" : error.message === "EMPTY_MODEL" ? "EMPTY" : "ERROR";
        setLoadState(state);
        setLoadMessage(state === "ERROR" ? (error.message || "알 수 없는 로딩 오류") : "");
      }
    }
    function render() { controls.update(); renderer.render(scene, camera); frameId = requestAnimationFrame(render); }
    initialize(); render();
    return () => { cancelled = true; cancelAnimationFrame(frameId); observer.disconnect(); transform.detach(); transform.dispose(); controls.dispose(); disposeObject3D(content); revokeSources(); grid.geometry.dispose(); grid.material.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [binding, equipment, theme]);

  const messages = { PROXY: "Proxy Model 표시 중", LOADING: "대용량 스캔 자산을 불러오는 중…", READY: "실제 자산 정합 모드", READY_FALLBACK: "모델 표시 중 · 텍스처 대신 기본 재질 적용", NO_3D: "이미지·텍스처는 하단 카메라 화면에서 확인합니다.", MISSING: "업로드 원본 파일을 다시 연결해 주세요.", UNSUPPORTED: "지원하지 않는 파일 형식입니다.", EMPTY: "파일에 표시할 3D 형상이 없습니다.", ERROR: "자산을 불러오지 못했습니다." };
  return <section className={styles.viewer} aria-label="설비 실제 자산 뷰어"><div ref={mountRef} className={styles.canvas} /><div className={styles.status} data-state={loadState}>{loadMessage || messages[loadState]}</div></section>;
}
