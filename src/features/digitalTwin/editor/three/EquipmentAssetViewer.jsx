import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { equipmentAssetRepository } from "@/features/digitalTwin/editor/api/equipmentAssetRepository";
import { ASSET_TYPES, EQUIPMENT_DISPLAY_MODES, unitScale } from "@/features/digitalTwin/editor/model/equipmentDetailModel";
import { createEquipmentObject } from "@/features/digitalTwin/editor/objects/EquipmentFactory";
import {
  attachDualTransformControls,
  configureDualTransformControls,
  createDualTransformControls,
  disposeDualTransformControls,
  setDualTransformDragging,
} from "@/features/digitalTwin/editor/three/dualTransformControls";
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
        } catch (error) {
          console.warn("[설비 상세 3D 뷰어] MTL 재질을 불러오지 못해 기본 재질을 사용합니다.", error);
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
        } catch (error) {
          console.warn("[설비 상세 3D 뷰어] PLY 텍스처를 불러오지 못해 기본 재질을 사용합니다.", error);
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

function applyAssetAlignment(runtime, binding, equipment) {
  if (!runtime?.actualObject || !runtime.aligned || !binding?.alignmentTransform) return false;
  const alignment = binding.alignmentTransform;
  const object = runtime.actualObject;
  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.scale.setScalar(unitScale(alignment.unit));
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return false;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  if (![center.x, center.y, center.z, size.x, size.y, size.z, bounds.min.y].every(Number.isFinite)) return false;
  if (alignment.autoCentered) {
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= alignment.floorAligned ? bounds.min.y : center.y;
  }
  const proxyDimensions = equipment?.dimensions ?? { width: 1, height: 2, depth: 0.8 };
  const fitScale = alignment.fitToProxy
    ? Math.min(
      proxyDimensions.width / Math.max(size.x, 0.001),
      proxyDimensions.height / Math.max(size.y, 0.001),
      proxyDimensions.depth / Math.max(size.z, 0.001),
    )
    : 1;
  runtime.aligned.position.set(alignment.position.x, alignment.position.y, alignment.position.z);
  runtime.aligned.rotation.set(alignment.rotation.x, alignment.rotation.y, alignment.rotation.z);
  runtime.aligned.scale.set(alignment.scale.x * fitScale, alignment.scale.y * fitScale, alignment.scale.z * fitScale);
  runtime.aligned.updateMatrixWorld(true);
  return true;
}

function updateDisplayMode(runtime, mode, transformTools) {
  if (!runtime || runtime.disposed) return;
  const showActual = Boolean(runtime.aligned && mode !== EQUIPMENT_DISPLAY_MODES.PROXY);
  if (runtime.proxy) runtime.proxy.visible = mode === EQUIPMENT_DISPLAY_MODES.PROXY || mode === EQUIPMENT_DISPLAY_MODES.COMPARE;
  if (runtime.aligned) runtime.aligned.visible = showActual;
  const target = showActual ? runtime.aligned : runtime.proxy;
  runtime.transformTarget = target;
  if (target) attachDualTransformControls(runtime.transformControls, target, transformTools, { camera: runtime.camera });
  else configureDualTransformControls(runtime.transformControls, transformTools, { camera: runtime.camera });
}

export default function EquipmentAssetViewer({ equipment, binding, transformTools, theme = "dark", onAlignmentChange }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onAlignmentChange);
  const runtimeRef = useRef(null);
  const equipmentRef = useRef(equipment);
  const bindingRef = useRef(binding);
  const transformToolsRef = useRef(transformTools);
  const themeRef = useRef(theme);
  const [loadState, setLoadState] = useState("PROXY");
  const [loadMessage, setLoadMessage] = useState("");
  equipmentRef.current = equipment;
  bindingRef.current = binding;
  transformToolsRef.current = transformTools;
  themeRef.current = theme;
  useEffect(() => { callbackRef.current = onAlignmentChange; }, [onAlignmentChange]);

  const assetLoadKey = binding ? [
    binding.assetId,
    binding.assetType,
    binding.sourceType,
    binding.sourceKey,
    binding.relatedSourceKey,
    binding.textureSourceKey,
    binding.objectUrl,
  ].join("|") : "";
  const equipmentDimensionsKey = JSON.stringify(equipment?.dimensions ?? {});
  const equipmentRenderKey = equipment ? [
    equipment.shapeTemplateId,
    equipment.name,
    equipment.showNameLabel === true,
    equipmentDimensionsKey,
    JSON.stringify(equipment.parameters),
    JSON.stringify(equipment.appearance),
    JSON.stringify(equipment.appearanceSlots),
    JSON.stringify(equipment.userTexture),
  ].join("|") : "";
  const alignmentKey = binding?.alignmentTransform ? JSON.stringify(binding.alignmentTransform) : "";
  const displayMode = binding && [ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(binding.assetType)
    ? binding.displayMode ?? EQUIPMENT_DISPLAY_MODES.ACTUAL
    : EQUIPMENT_DISPLAY_MODES.PROXY;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !equipmentRef.current) return undefined;
    let frameId;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(themeRef.current === "light" ? 0xe8eef1 : 0x0b1217);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (error) {
      console.error("[설비 상세 3D 뷰어] WebGL 렌더러 초기화에 실패했습니다.", error);
      queueMicrotask(() => {
        setLoadState("WEBGL_ERROR");
        setLoadMessage(error.message || "WebGL을 초기화할 수 없습니다.");
      });
      return undefined;
    }
    renderer.domElement.setAttribute("aria-label", "설비 실제 자산 정합 3D 뷰어"); mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000); camera.position.set(3, 2.4, 3.4);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xdaf5ff, 0x17232b, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.4); light.position.set(4, 7, 5); scene.add(light);
    const planeSize = Math.max(equipmentRef.current.dimensions?.width ?? 1, equipmentRef.current.dimensions?.depth ?? 1, 1) * 8;
    const grid = new THREE.GridHelper(planeSize, 24, 0x456577, 0x243843); scene.add(grid);
    const content = new THREE.Group(); scene.add(content);
    const transformControls = createDualTransformControls(camera, renderer.domElement, scene, { translationSnap: 0.01 });
    const runtime = { scene, renderer, camera, controls, content, grid, transformControls, proxy: null, aligned: null, actualObject: null, transformTarget: null, disposed: false };
    runtimeRef.current = runtime;
    const commitTransform = (control) => {
      if (!control.object || control.object !== runtime.aligned) return;
      const transform = {
        position: { x: control.object.position.x, y: control.object.position.y, z: control.object.position.z },
        rotation: { x: control.object.rotation.x, y: control.object.rotation.y, z: control.object.rotation.z },
      };
      if (bindingRef.current?.alignmentTransform) {
        bindingRef.current = {
          ...bindingRef.current,
          alignmentTransform: { ...bindingRef.current.alignmentTransform, ...transform },
        };
      }
      callbackRef.current?.(transform);
    };
    const handleTranslateCommit = () => commitTransform(transformControls.translate);
    const handleRotateCommit = () => commitTransform(transformControls.rotate);
    const handleTranslateDragging = (event) => {
      controls.enabled = !event.value;
      setDualTransformDragging(transformControls, transformControls.translate, event.value, transformToolsRef.current);
    };
    const handleRotateDragging = (event) => {
      controls.enabled = !event.value;
      setDualTransformDragging(transformControls, transformControls.rotate, event.value, transformToolsRef.current);
    };
    transformControls.translate.addEventListener("mouseUp", handleTranslateCommit);
    transformControls.rotate.addEventListener("mouseUp", handleRotateCommit);
    transformControls.translate.addEventListener("dragging-changed", handleTranslateDragging);
    transformControls.rotate.addEventListener("dragging-changed", handleRotateDragging);

    function resize() { const rect = mount.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); }
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();

    function render() { controls.update(); renderer.render(scene, camera); frameId = requestAnimationFrame(render); }
    render();
    return () => {
      runtime.disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      transformControls.translate.removeEventListener("mouseUp", handleTranslateCommit);
      transformControls.rotate.removeEventListener("mouseUp", handleRotateCommit);
      transformControls.translate.removeEventListener("dragging-changed", handleTranslateDragging);
      transformControls.rotate.removeEventListener("dragging-changed", handleRotateDragging);
      disposeDualTransformControls(transformControls);
      controls.dispose();
      disposeObject3D(content);
      runtime.proxy = null;
      runtime.aligned = null;
      runtime.actualObject = null;
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) runtime.scene.background.set(theme === "light" ? 0xe8eef1 : 0x0b1217);
  }, [theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !equipmentRef.current) return;
    const previousProxy = runtime.proxy;
    const proxy = createProxy(equipmentRef.current, displayMode === EQUIPMENT_DISPLAY_MODES.COMPARE, theme);
    runtime.proxy = proxy;
    runtime.content.add(proxy);
    if (previousProxy) {
      runtime.content.remove(previousProxy);
      disposeObject3D(previousProxy);
    }
    updateDisplayMode(runtime, displayMode, transformToolsRef.current);
    if (!runtime.aligned || displayMode === EQUIPMENT_DISPLAY_MODES.PROXY) fitCamera(runtime.camera, runtime.controls, proxy);
  }, [displayMode, equipmentRenderKey, theme]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const bindingSnapshot = bindingRef.current;
    const hasRenderableBinding = Boolean(bindingSnapshot && [ASSET_TYPES.OBJ, ASSET_TYPES.PLY].includes(bindingSnapshot.assetType));
    if (!runtime || !hasRenderableBinding) {
      setLoadState("PROXY");
      return undefined;
    }
    let cancelled = false;
    let loadedObject = null;
    let revokeSources = () => {};
    setLoadState("LOADING");
    setLoadMessage("");
    (async () => {
      try {
        const loaded = await loadBindingObject(bindingSnapshot);
        loadedObject = loaded.object;
        revokeSources = loaded.revoke;
        if (cancelled || runtime.disposed) { disposeObject3D(loadedObject); revokeSources(); return; }
        const aligned = new THREE.Group();
        aligned.add(loadedObject);
        runtime.actualObject = loadedObject;
        runtime.aligned = aligned;
        runtime.content.add(aligned);
        if (!applyAssetAlignment(runtime, bindingRef.current, equipmentRef.current)) throw new Error("EMPTY_MODEL");
        updateDisplayMode(runtime, bindingRef.current?.displayMode ?? EQUIPMENT_DISPLAY_MODES.ACTUAL, transformToolsRef.current);
        if (!fitCamera(runtime.camera, runtime.controls, aligned)) throw new Error("EMPTY_MODEL");
        setLoadState(loaded.fallbackMaterial ? "READY_FALLBACK" : "READY");
      } catch (error) {
        if (cancelled) return;
        console.error(`[설비 상세 3D 뷰어] ${bindingSnapshot?.sourceKey || bindingSnapshot?.name || "3D 자산"} 로딩에 실패했습니다.`, error);
        if (runtime.aligned) {
          runtime.content.remove(runtime.aligned);
          disposeObject3D(runtime.aligned);
          runtime.aligned = null;
          runtime.actualObject = null;
        }
        updateDisplayMode(runtime, EQUIPMENT_DISPLAY_MODES.PROXY, transformToolsRef.current);
        if (runtime.proxy) fitCamera(runtime.camera, runtime.controls, runtime.proxy);
        const state = error.message === "MISSING_LOCAL_FILE" ? "MISSING" : error.message === "UNSUPPORTED" ? "UNSUPPORTED" : error.message === "EMPTY_MODEL" ? "EMPTY" : "ERROR";
        setLoadState(state);
        setLoadMessage(state === "ERROR" ? (error.message || "알 수 없는 로딩 오류") : "");
      }
    })();
    return () => {
      cancelled = true;
      if (!runtime.disposed && runtime.aligned) {
        runtime.content.remove(runtime.aligned);
        disposeObject3D(runtime.aligned);
        runtime.aligned = null;
        runtime.actualObject = null;
      } else if (!runtime.disposed && loadedObject) {
        disposeObject3D(loadedObject);
      }
      revokeSources();
      updateDisplayMode(runtime, EQUIPMENT_DISPLAY_MODES.PROXY, transformToolsRef.current);
    };
  }, [assetLoadKey]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime?.aligned) return;
    applyAssetAlignment(runtime, bindingRef.current, equipmentRef.current);
  }, [alignmentKey, equipmentDimensionsKey]);

  useEffect(() => {
    updateDisplayMode(runtimeRef.current, displayMode, transformTools);
  }, [displayMode, transformTools]);

  const messages = { PROXY: "Proxy Model 표시 중", LOADING: "대용량 스캔 자산을 불러오는 중…", READY: "실제 자산 정합 모드", READY_FALLBACK: "모델 표시 중 · 텍스처 대신 기본 재질 적용", NO_3D: "이미지·텍스처는 하단 카메라 화면에서 확인합니다.", MISSING: "업로드 원본 파일을 다시 연결해 주세요.", UNSUPPORTED: "지원하지 않는 파일 형식입니다.", EMPTY: "파일에 표시할 3D 형상이 없습니다.", WEBGL_ERROR: "WebGL 뷰어를 초기화하지 못했습니다.", ERROR: "자산을 불러오지 못했습니다." };
  return <section className={styles.viewer} aria-label="설비 실제 자산 뷰어"><div ref={mountRef} className={styles.canvas} /><div className={styles.status} data-state={loadState}>{loadMessage || messages[loadState]}</div></section>;
}
