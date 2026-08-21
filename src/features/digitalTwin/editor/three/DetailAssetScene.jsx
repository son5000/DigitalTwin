import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { disposeObject3D } from "./disposeObject3D";
import styles from "./DetailAssetScene.module.css";

async function loadDetailObject(asset) {
  if (asset.originalFormat === "GLB" || asset.originalFormat === "GLTF") {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(asset.objectUrl);
    return gltf.scene;
  }

  if (asset.originalFormat === "OBJ") {
    const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
    return new OBJLoader().loadAsync(asset.objectUrl);
  }

  if (asset.originalFormat === "PLY") {
    const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
    const geometry = await new PLYLoader().loadAsync(asset.objectUrl);
    geometry.computeVertexNormals();
    return new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: 0x8fb3c2, roughness: 0.62, vertexColors: geometry.hasAttribute("color") }),
    );
  }

  throw new Error("지원하지 않는 형식입니다.");
}

function fitCameraToObject(camera, controls, object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 0.1);
  const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.7;
  camera.position.copy(center).add(new THREE.Vector3(distance, distance * 0.65, distance));
  camera.near = Math.max(distance / 100, 0.001);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

export default function DetailAssetScene({ asset }) {
  const mountRef = useRef(null);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !asset.objectUrl) {
      setLoadState("missing");
      return undefined;
    }

    let cancelled = false;
    let animationFrameId;
    let detailObject;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1217);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "3D 스캔 상세 모델");
    mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(3, 2, 3);
    scene.add(new THREE.HemisphereLight(0xd9f4ff, 0x15232b, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);
    const grid = new THREE.GridHelper(20, 40, 0x4b718c, 0x243943);
    scene.add(grid);
    let controls;

    function resize() {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    async function initialize() {
      try {
        const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
        if (cancelled) return;
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        detailObject = await loadDetailObject(asset);
        if (cancelled) {
          disposeObject3D(detailObject);
          return;
        }

        const { calibration } = asset;
        detailObject.position.set(calibration.positionX, calibration.positionY, calibration.positionZ);
        detailObject.rotation.set(
          THREE.MathUtils.degToRad(calibration.rotationX),
          THREE.MathUtils.degToRad(calibration.rotationY),
          THREE.MathUtils.degToRad(calibration.rotationZ),
        );
        detailObject.scale.setScalar(calibration.scale);
        scene.add(detailObject);
        fitCameraToObject(camera, controls, detailObject);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    function render() {
      controls?.update();
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    }

    initialize();
    render();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls?.dispose();
      if (detailObject) disposeObject3D(detailObject);
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [asset]);

  return (
    <div className={styles.scene} ref={mountRef}>
      {loadState !== "ready" && (
        <div className={styles.status} role="status">
          {loadState === "loading" && "상세 모델을 불러오는 중…"}
          {loadState === "missing" && "로컬 원본 파일을 다시 등록해 주세요."}
          {loadState === "error" && "모델을 불러오지 못했습니다. 파일 형식을 확인해 주세요."}
        </div>
      )}
    </div>
  );
}
